import {
  F,
  Task,
  Success,
  Empty,
  Maybe,
  CusError,
  Logger
} from 'vod-fp-utility';
import { ACTION, PROCESS, LOADPROCESS } from '../store';
import { toMuxTs } from '../mux/mux';
import loader from '../loader/loader';
import { SEGMENT_ERROR, XHR_ERROR } from '../error';

const { compose, head, map, filter } = F;
let logger = new Logger('player');

function _binarySearch(tolerance, list, start, end, bufferEnd) {
  if (start > end) {
    return -1;
  }
  const mid = start + Math.floor((end - start) / 2);
  if (list[mid].end < bufferEnd + tolerance) {
    start = mid + 1;
    return _binarySearch(tolerance, list, start, end, bufferEnd);
  } else if (list[mid].start > bufferEnd + tolerance) {
    end = mid - 1;
    return _binarySearch(tolerance, list, start, end, bufferEnd);
  } else {
    return list[mid];
  }
  return -1;
}

function findSegment({ getConfig }, segments, bufferEnd) {
  let maxFragLookUpTolerance = getConfig(
    ACTION.CONFIG.MAX_FRAG_LOOKUP_TOLERANCE
  );
  let seg = _binarySearch(
    maxFragLookUpTolerance,
    segments,
    0,
    segments.length - 1,
    bufferEnd
  );
  if (seg === -1) {
    return;
  }
  return seg;
}

function findSegmentOfCurrentPosition({ getState, connect, getConfig }) {
  return Maybe.of(
    F.curry((segments, media) => {
      return connect(findSegment)(segments, media.currentTime);
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.MEDIA.MEDIA_ELE));
}

function abortLoadingSegment({ dispatch }) {
  dispatch(ACTION.REMOVE_ABORTABLE);
}

// segment -> Task
function loadSegment() {
  let lastSegment = null;
  return ({ getConfig, getState, connect, dispatch }, segment) => {
    dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADING);
    logger.log(
      'matched audio segment,',
      getState(ACTION.PLAYLIST.FIND_MEDIA_SEGEMENT, {
        levelId: segment.levelId,
        id: segment.id
      })
    );

    return connect(loader)({
      url: segment.url,
      options: {
        responseType: 'arraybuffer',
        timeout: getConfig(ACTION.CONFIG.MAX_TIMEOUT)
      }
    })
      .filterRetry(e => !e.is(XHR_ERROR.ABORT))
      .retry(
        getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
        getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
      )
      .map(buffer => {
        dispatch(ACTION.FLYBUFFER.STORE_NEW_SEGMENT, {
          segment,
          buffer
        });
        dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADED);
      })
      .error(e => {
        if (e.is(XHR_ERROR.ABORT)) {
          // getState(ACTION.PROCESS)
          //   .map(x => (x !== PROCESS.LEVEL_CHANGING ? true : undefined))
          //   .map(() => {
          //   });
          dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ABORT);
        } else {
          dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ERROR);
          dispatch(
            ACTION.ERROR,
            e.merge(CusError.of(SEGMENT_ERROR[e.detail()]))
          );
        }
      });
  };
}

function drainSegmentFromStore(
  { getState, connect, dispatch, subOnce },
  findedSeg
) {
  return getState(ACTION.FLYBUFFER.GET_MATCHED_SEGMENT, findedSeg).map(
    segInfo => {
      let { segment, buffer } = segInfo;
      dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
      connect(toMuxTs)(
        segment,
        buffer,
        segment.id,
        getState(ACTION.PLAYLIST.FIND_KEY_INFO).value()
      );
      return true;
    }
  );
}

function removeSegmentFromStore({ getState, dispatch }) {
  getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID).map(id => {
    dispatch(ACTION.FLYBUFFER.REMOVE_SEGMENT_FROM_STORE, id);
  });
}

abortLoadingSegment = F.curry(abortLoadingSegment);
findSegment = F.curry(findSegment);
loadSegment = F.curry(loadSegment());
findSegmentOfCurrentPosition = F.curry(findSegmentOfCurrentPosition);
drainSegmentFromStore = F.curry(drainSegmentFromStore);
removeSegmentFromStore = F.curry(removeSegmentFromStore);
export {
  findSegment,
  loadSegment,
  abortLoadingSegment,
  findSegmentOfCurrentPosition,
  drainSegmentFromStore,
  removeSegmentFromStore
};

import { F, Task, Success, Empty, Maybe, CusError } from 'vod-fp-utility';
import { ACTION, PROCESS, LOADPROCESS } from '../store';
import { toMux } from '../mux/mux';
import loader from '../loader/loader';
import { SEGMENT_ERROR, LOADER_ERROR } from '../error';

const { compose, head, map, filter, curry, trace } = F;

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

function _loadSource({ connect, getConfig }, url) {
  return connect(loader)({
    url: url,
    useStream: true,
    params: {
      responseType: 'arraybuffer',
      timeout: getConfig(ACTION.CONFIG.MAX_TIMEOUT)
    }
  });
}
_loadSource = curry(_loadSource);

// segment -> Task
function loadSegment() {
  let lastSegment = null;
  return ({ getConfig, getState, connect, dispatch }, segment) => {
    dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADING);

    let _loadTask = getState(ACTION.PLAYLIST.FIND_MEDIA_SEGEMENT, {
      levelId: segment.levelId,
      id: segment.id
    })
      .map(trace('log: matched audio segment'))
      .chain(audioSegment => {
        return Task.of((resolve, reject) => {
          Task.resolve(
            curry((videoBuffer, audioBuffer) => {
              resolve({ videoBuffer, audioBuffer });
            })
          )
            .ap(connect(_loadSource)(segment.url))
            .ap(connect(_loadSource)(audioSegment.url))
            .error(reject);
        });
      })
      .getOrElse(() => connect(_loadSource)(segment.url));

    return _loadTask
      .filterRetry(e => !e.is(LOADER_ERROR.ABORT))
      .retry(
        getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
        getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
      )
      .map(buffer => {
        dispatch(ACTION.FLYBUFFER.STORE_NEW_SEGMENT, {
          segment,
          buffer:
            buffer instanceof ArrayBuffer ? { videoBuffer: buffer } : buffer
        });
        dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADED);
      })
      .error(e => {
        if (e.is(LOADER_ERROR.ABORT)) {
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
      connect(toMux)(
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

function loadInitMP4({ getState, dispatch, getConfig, connect }) {
  dispatch(ACTION.PROCESS, PROCESS.INIT_MP4_LOADING);
  getState(ACTION.PLAYLIST.FIND_INIT_MP4)
    .map(trace('log: find init mp4'))
    .chain(initUrls => {
      return Task.of((resolve, reject) => {
        Task.resolve(
          curry((videoBuffer, audioBuffer) => {
            resolve({ videoBuffer, audioBuffer });
          })
        )
          .ap(connect(_loadSource)(initUrls.levelInitMp4))
          .ap(connect(_loadSource)(initUrls.mediaInitMp4))
          .error(reject);
      });
    })
    .filterRetry(e => !e.is(LOADER_ERROR.ABORT))
    .retry(
      getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
      getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
    )
    .map(buffer => {
      dispatch(ACTION.PROCESS, PROCESS.INIT_MP4_LOADED);
      connect(toMux)(null, buffer, -1, null);
    })
    .error(e => {
      if (!e.is(LOADER_ERROR.ABORT)) {
        dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ERROR);
        dispatch(ACTION.ERROR, e.merge(CusError.of(SEGMENT_ERROR[e.detail()])));
      }
    });
}

abortLoadingSegment = F.curry(abortLoadingSegment);
findSegment = F.curry(findSegment);
loadSegment = F.curry(loadSegment());
findSegmentOfCurrentPosition = F.curry(findSegmentOfCurrentPosition);
drainSegmentFromStore = F.curry(drainSegmentFromStore);
removeSegmentFromStore = F.curry(removeSegmentFromStore);
loadInitMP4 = F.curry(loadInitMP4);
export {
  findSegment,
  loadSegment,
  abortLoadingSegment,
  findSegmentOfCurrentPosition,
  drainSegmentFromStore,
  removeSegmentFromStore,
  loadInitMP4
};

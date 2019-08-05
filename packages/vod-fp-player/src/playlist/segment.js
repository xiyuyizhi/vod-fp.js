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
import { toMux } from '../mux/mux';
import loader from '../loader/loader';
import { SEGMENT_ERROR, LOADER_ERROR } from '../error';
import { inSureNextLoadLevelReady } from './playlist';

const { compose, head, map, filter, curry, trace } = F;
const logger = new Logger('player');

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

function _loadSource({ connect, getConfig }, url, levelId = 1) {
  return connect(loader)({
    url: url,
    useStream: true,
    params: {
      responseType: 'arraybuffer',
      timeout: levelId === 1 ? getConfig(ACTION.CONFIG.SEGMENT_MAX_TIMEOUT) : 0
      // only the lowest level set the timeout time
    }
  });
}

// segment -> Task
function loadSegment({ getConfig, getState, connect, dispatch }, segment) {
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
          .ap(connect(_loadSource)(segment.url, segment.levelId))
          .ap(connect(_loadSource)(audioSegment.url, audioSegment.levelId))
          .error(reject);
      });
    })
    .getOrElse(() => connect(_loadSource)(segment.url, segment.levelId));

  return _loadTask
    .filterRetry(e => !e.is(LOADER_ERROR.ABORT))
    .retry(
      getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
      getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
    )
    .map(data => {
      dispatch(ACTION.FLYBUFFER.STORE_NEW_SEGMENT, {
        segment,
        buffer:
          data.buffer instanceof ArrayBuffer ? { videoBuffer: data } : data
      });
      // emit segment loaded or when use abr, to check the nextAutoLevel ready
      getState(ACTION.PLAYLIST.CAN_ABR)
        .map(() => {
          connect(inSureNextLoadLevelReady).map(() => {
            dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADED);
          });
          return true;
        })
        .getOrElse(() => {
          dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOADED);
        });
    })
    .error(e => {
      if (e.is(LOADER_ERROR.ABORT)) {
        getState(ACTION.PLAYLIST.CAN_ABR)
          .map(() => {
            connect(inSureNextLoadLevelReady).map(() => {
              dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ABORT);
            });
            return true;
          })
          .getOrElse(() => {
            dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ABORT);
          });
      } else {
        dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ERROR);
        dispatch(ACTION.ERROR, e.merge(CusError.of(SEGMENT_ERROR[e.detail()])));
      }
    });
}

// when it‘s fmp4,before drain segment,
// we need check the next segment levelId is equal the current segment,
// if it‘s not ,we need append the init.mp4 buffer first.
function drainSegmentFromStore() {
  let lastAppend;
  return (
    { getState, getConfig, connect, dispatch, subOnce },
    findSeg
  ) => {
    // findSeg: the selected segement in check buffer,we need check is it stored in fly buffer store
    return getState(ACTION.FLYBUFFER.GET_MATCHED_SEGMENT, findSeg).map(
      segInfo => {
        let { segment, buffer } = segInfo;
        dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
        if (
          getState(ACTION.PLAYLIST.CAN_ABR).value() &&
          lastAppend &&
          lastAppend.levelId !== segment.levelId &&
          getState(ACTION.PLAYLIST.FORMAT) === 'fmp4'
        ) {
          logger.log(`the next append segment levelId changed [${lastAppend.levelId} -> ${segment.levelId}],need append init sgemnt first`)
          lastAppend = segment;
          connect(loadInitMP4)(segment.levelId, true);
          setTimeout(() => {
            connect(toMux)(
              segment,
              buffer,
              segment.id,
              getState(ACTION.PLAYLIST.FIND_KEY_INFO).value(),
              false
            );
          }, 50);
          return true;
        }
        lastAppend = segment;
        connect(toMux)(
          segment,
          buffer,
          segment.id,
          getState(ACTION.PLAYLIST.FIND_KEY_INFO).value(),
          false
        );
        return true;
      }
    );
  }
}


function removeSegmentFromStore({ getState, dispatch }) {
  getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID).map(id => {
    dispatch(ACTION.FLYBUFFER.REMOVE_SEGMENT_FROM_STORE, id);
  });
}

function _loadInit({ getState, dispatch, getConfig, connect }, levelId, immediateMux) {
  getState(ACTION.PLAYLIST.FIND_INIT_MP4_URLS)
    .map(trace(`log: find level ${levelId} init mp4 urls`))
    .chain(initUrls => {
      return Task.of((resolve, reject) => {
        Task.resolve(
          curry((videoBuffer, audioBuffer) => {
            resolve({ videoBuffer, audioBuffer });
          })
        )
          .ap(connect(_loadSource)(initUrls.levelInitMp4Url, undefined))
          .ap(connect(_loadSource)(initUrls.mediaInitMp4Url, undefined))
          .error(reject);
      });
    })
    .filterRetry(e => !e.is(LOADER_ERROR.ABORT))
    .retry(
      getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
      getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
    )
    .map(buffer => {
      // store init mp4 buffer
      dispatch(ACTION.PLAYLIST.MP4_METADATA, { buffer, levelId });
      dispatch(ACTION.PROCESS, PROCESS.INIT_MP4_LOADED);
      if (immediateMux) {
        logger.log('mux init mp4');
        connect(toMux)(null, buffer, -1, null, true);
      }
    })
    .error(e => {
      if (!e.is(LOADER_ERROR.ABORT)) {
        dispatch(ACTION.LOADPROCESS, LOADPROCESS.SEGMENT_LOAD_ERROR);
        dispatch(ACTION.ERROR, e.merge(CusError.of(SEGMENT_ERROR[e.detail()])));
      }
    });
}

/**
 * 
 * @param {object} param0 
 * @param {number} levelId the level need to load metadata
 * @param {boolean} immediateMux if mux right when loaded
 * condition:
 *    1. manual change level
 *    2. in abr,level changed
 *    3. in dragSegmentFromStore, segment level changed,need append metadata
 */
function loadInitMP4({ connect, getState, dispatch }, levelId, immediateMux) {
  dispatch(ACTION.PROCESS, PROCESS.INIT_MP4_LOADING);
  getState(ACTION.PLAYLIST.MP4_METADATA, { levelId })
    .map(trace('log: find stored init mp4 buffers'))
    .map(({ levelInit, mediaInit }) => {
      if (immediateMux) {
        logger.log('mux init mp4');
        connect(toMux)(
          null,
          {
            videoBuffer: levelInit,
            audioBuffer: mediaInit
          },
          -1,
          null,
          true
        );
      }
      dispatch(ACTION.PROCESS, PROCESS.INIT_MP4_LOADED);
      return true;
    })
    .getOrElse(() => {
      connect(_loadInit)(levelId, immediateMux);
    });
}

_loadSource = curry(_loadSource);
_loadInit = curry(_loadInit);
abortLoadingSegment = F.curry(abortLoadingSegment);
findSegment = F.curry(findSegment);
loadSegment = F.curry(loadSegment);
findSegmentOfCurrentPosition = F.curry(findSegmentOfCurrentPosition);
drainSegmentFromStore = F.curry(drainSegmentFromStore());
removeSegmentFromStore = F.curry(removeSegmentFromStore);
loadInitMP4 = curry(loadInitMP4);
export {
  findSegment,
  loadSegment,
  abortLoadingSegment,
  findSegmentOfCurrentPosition,
  drainSegmentFromStore,
  removeSegmentFromStore,
  loadInitMP4
};

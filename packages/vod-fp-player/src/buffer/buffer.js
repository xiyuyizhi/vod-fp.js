import {
  F,
  Success,
  Maybe,
  CusError,
  either,
  maybe,
  maybeToEither,
  eitherToMaybe,
  Task,
  Logger
} from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { checkManualSeek } from '../media/media';
import { MEDIA_ERROR } from '../error';
import { removeSegmentFromStore } from '../playlist/segment';
import { getBufferInfo } from './buffer-helper';
import { checkSeekAfterBufferAppend } from '../playlist/m3u8-live';
const { map, compose, curry, join, chain, prop, trace } = F;

let logger = new Logger('player');

function _bindSourceBufferEvent({ connect, getState, dispatch }, type, sb) {
  const _waitFinished = (other, me) => {
    map(x => {
      if (x === true) {
        // video audio all append
        connect(_afterAppended)(true);
      } else {
        dispatch(me, true);
      }
    })(getState(other));
  };
  sb.addEventListener('updateend', function(_) {
    if (type === 'video') {
      getState(ACTION.BUFFER.VIDEO_BUFFER_INFO).map(x => {
        if (x.combine) {
          _waitFinished(
            ACTION.BUFFER.AUDIO_APPENDED,
            ACTION.BUFFER.VIDEO_APPENDED
          );
        } else {
          connect(_afterAppended)(false);
        }
      });
    }
    if (type === 'audio') {
      getState(ACTION.BUFFER.AUDIO_BUFFER_INFO).map(x => {
        if (x.combine) {
          _waitFinished(
            ACTION.BUFFER.VIDEO_APPENDED,
            ACTION.BUFFER.AUDIO_APPENDED
          );
        } else {
          connect(_afterAppended)(false);
        }
      });
    }
  });
  sb.addEventListener('error', e => {
    dispatch(
      ACTION.ERROR,
      CusError.of(e).merge(CusError.of(MEDIA_ERROR.SOURCEBUFFER_ERROR))
    );
  });
  return sb;
}

function _afterAppended({ getState, getConfig, dispatch, connect }, combine) {
  dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDED);
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);

  let segBound;

  Maybe.of(
    curry((videoBufferInfo, audioBufferInfo) => {
      logger.log(
        `buffer:  video=[${videoBufferInfo.startPTS /
          90000},${videoBufferInfo.endPTS / 90000}]`,
        `audio=[${audioBufferInfo.startPTS / 90000},${audioBufferInfo.endPTS /
          90000}]`
      );
      let startPTS = Math.min(
        videoBufferInfo.startPTS,
        audioBufferInfo.startPTS
      );
      let endPTS = Math.min(videoBufferInfo.endPTS, audioBufferInfo.endPTS);
      segBound = {
        startPTS,
        endPTS
      };
    })
  )
    .ap(getState(ACTION.BUFFER.VIDEO_BUFFER_INFO))
    .ap(getState(ACTION.BUFFER.AUDIO_BUFFER_INFO));

  let format = getState(ACTION.PLAYLIST.FORMAT);

  if (format === 'ts') {
    if (!combine) {
      segBound = getState(ACTION.BUFFER.VIDEO_BUFFER_INFO).getOrElse(() => {
        return getState(ACTION.BUFFER.AUDIO_BUFFER_INFO).value();
      });
    }
    segBound = {
      start: parseFloat((segBound.startPTS / 90000).toFixed(6)),
      end: parseFloat((segBound.endPTS / 90000).toFixed(6))
    };
    connect(checkManualSeek)(segBound.start);
    connect(checkSeekAfterBufferAppend)(segBound);
    dispatch(ACTION.PLAYLIST.UPDATE_SEGMENTS_BOUND, segBound);
  }

  if (format === 'flvLive') {
    getState(ACTION.MEDIA.MEDIA_ELE).map(media => {
      if (
        !media.paused &&
        segBound.startPTS / 90000 - media.currentTime >
          getConfig(ACTION.CONFIG.FLV_LIVE_MAX_DELAY)
      ) {
        logger.warn('current time break away from live position,seek');
        media.currentTime = segBound.startPTS / 90000;
      }
    });
  }

  //清除无用元素
  dispatch(ACTION.BUFFER.VIDEO_BUFFER_REMOVE);
  dispatch(ACTION.BUFFER.AUDIO_BUFFER_REMOVE);
  connect(removeSegmentFromStore);
  connect(_checkFlushBuffer).map(() => {
    dispatch(ACTION.PROCESS, PROCESS.IDLE);
  });
}

// (Maybe,string,string)  -> Maybe
function _createSourceBuffer({ dispatch, connect }, mediaSource, type, mime) {
  logger.log('create source buffer with mime: ', mime);
  return mediaSource.chain(ms => {
    let _create = Success.of(ms)
      .map(ms => ms.addSourceBuffer(mime))
      .map(connect(_bindSourceBufferEvent)(type))
      .map(sb => {
        if (type === 'video') {
          dispatch(ACTION.BUFFER.VIDEO_SOURCEBUFFER, sb);
        }
        if (type === 'audio') {
          dispatch(ACTION.BUFFER.AUDIO_SOURCEBUFFER, sb);
        }
        return sb;
      })
      .error(e => {
        dispatch(
          ACTION.ERROR,
          e.merge(CusError.of(MEDIA_ERROR.ADD_SOURCEBUFFER_ERROR))
        );
      });
    return eitherToMaybe(_create);
  });
}

function bufferBootstrap({ getState, subscribe, dispatch, connect, subOnce }) {
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);

  // (Maybe,Maybe) -> Either
  let doAppend = (sourcebuffer, bufferInfo) => {
    sourcebuffer.map(sb => {
      return Success.of(bufferInfo)
        .map(prop('buffer'))
        .map(buffer => sb.appendBuffer(buffer))
        .error(e => {
          if (e) {
            connect(removeSegmentFromStore);
            dispatch(
              ACTION.ERROR,
              e.merge(CusError.of(MEDIA_ERROR.SOURCEBUFFER_ERROR))
            );
          }
        });
    });
  };
  let createSourceBuffer = connect(_createSourceBuffer);

  subscribe(ACTION.BUFFER.VIDEO_BUFFER_INFO, bufferInfo => {
    bufferInfo.map(info => {
      let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
        return createSourceBuffer(
          mediaSource,
          'video',
          `video/mp4; codecs="${info.videoInfo.codec}"`
        ).value();
      });
      //保证音视频分别提取后,video audio sb 创建成功后、开始append
      subOnce(PROCESS.MUXED, () => doAppend(Maybe.of(sb), info));
    });
  });

  subscribe(ACTION.BUFFER.AUDIO_BUFFER_INFO, bufferInfo => {
    bufferInfo.map(info => {
      dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDING);
      let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
        return createSourceBuffer(
          mediaSource,
          'audio',
          `video/mp4; codecs="${info.audioInfo.codec}"`
        ).value();
      });
      subOnce(PROCESS.MUXED, () => doAppend(Maybe.of(sb), info));
    });
  });
}

// void -> Task
function _checkFlushBuffer({ getState, getConfig, connect }) {
  let media = getState(ACTION.MEDIA.MEDIA_ELE).join();
  let flushEnd = Math.max(
    0,
    media.currentTime - getConfig(ACTION.CONFIG.MAX_FLY_BUFFER_LENGTH)
  );
  if (connect(getBufferInfo)(flushEnd).bufferLength && flushEnd) {
    logger.log(`flush buffer , [0,${flushEnd}]`);
    return connect(flushBuffer)(0, flushEnd);
  }
  return Task.resolve();
}

// (number,number) ->Task
function flushBuffer({ getState, dispatch }, start, end) {
  let vsb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER)
    .map(vsb => {
      if (!vsb.updating) {
        vsb.remove(start, end);
      }
      return vsb;
    })
    .getOrElse(null);

  let asb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER)
    .map(asb => {
      if (!asb.updating) {
        asb.remove(start, end);
      }
      return asb;
    })
    .getOrElse(null);

  return Task.of((resolve, reject) => {
    let timer;
    timer = setInterval(() => {
      if (asb && asb.updating) return;
      if (vsb && vsb.updating) return;
      clearInterval(timer);
      resolve();
    }, 2);
  });
}

function abortBuffer({ getState, dispatch }) {
  Maybe.of(
    curry((vsb, asb, _) => {
      dispatch(ACTION.BUFFER.AUDIO_SOURCEBUFFER, null);
      dispatch(ACTION.BUFFER.VIDEO_SOURCEBUFFER, null);
      vsb.abort();
      asb.abort();
    })
  )
    .ap(getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER))
    .ap(getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER))
    .ap(
      getState(ACTION.MEDIA.MEDIA_SOURCE)
        .map(prop('readyState'))
        .map(state => state === 'open' || undefined)
    );
}

_afterAppended = curry(_afterAppended);
_bindSourceBufferEvent = curry(_bindSourceBufferEvent);
_createSourceBuffer = curry(_createSourceBuffer);
_checkFlushBuffer = curry(_checkFlushBuffer);
bufferBootstrap = curry(bufferBootstrap);
flushBuffer = curry(flushBuffer);
abortBuffer = curry(abortBuffer);
export { bufferBootstrap, flushBuffer, abortBuffer };

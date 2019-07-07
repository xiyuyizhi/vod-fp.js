import {
  F,
  Success,
  Maybe,
  CusError,
  either,
  maybe,
  maybeToEither,
  eitherToMaybe,
  Logger
} from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { checkManualSeek } from '../media/media';
import { MEDIA_ERROR } from '../error';
import { removeSegmentFromStore } from '../playlist/segment';

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

function _afterAppended({ getState, dispatch, connect }, combine) {
  dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDED);
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);

  let segBound;
  if (getState(ACTION.PLAYLIST.FORMAT) === 'ts') {
    if (!combine) {
      segBound = getState(ACTION.BUFFER.VIDEO_BUFFER_INFO).getOrElse(() => {
        return getState(ACTION.BUFFER.AUDIO_BUFFER_INFO).value();
      });
    } else {
      Maybe.of(
        curry((videoBufferInfo, audioBufferInfo) => {
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
    }

    segBound = {
      start: parseFloat((segBound.startPTS / 90000).toFixed(6)),
      end: parseFloat((segBound.endPTS / 90000).toFixed(6))
    };
    connect(checkManualSeek)(segBound.start);
    dispatch(ACTION.PLAYLIST.UPDATE_SEGMENTS_BOUND, segBound);
  }

  //清除无用元素
  dispatch(ACTION.BUFFER.VIDEO_BUFFER_REMOVE);
  dispatch(ACTION.BUFFER.AUDIO_BUFFER_REMOVE);
  connect(removeSegmentFromStore);
  dispatch(ACTION.PROCESS, PROCESS.IDLE);
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

function startBuffer({ getState, subscribe, dispatch, connect }) {
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);

  // (Maybe,Maybe) -> Either
  let doAppend = (sourcebuffer, bufferInfo) => {
    sourcebuffer.map(sb => {
      return Success.of(
        curry(buffer => {
          sb.appendBuffer(buffer);
        })
      )
        .ap(
          compose(
            map(prop('buffer')),
            maybeToEither
          )(bufferInfo)
        )
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
    let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'video',
        'video/mp4; codecs="avc1.42E01E"'
      ).value();
    });
    doAppend(Maybe.of(sb), bufferInfo);
  });

  subscribe(ACTION.BUFFER.AUDIO_BUFFER_INFO, bufferInfo => {
    let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'audio',
        'video/mp4; codecs="mp4a.40.2"'
      ).value();
    });
    bufferInfo.map(() => dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDING));
    doAppend(Maybe.of(sb), bufferInfo);
  });
}

function flushBuffer({ getState, dispatch }, start, end) {
  let videoSb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER);
  let audioSb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER);
  return Success.of(
    curry((videoSb, audioSb) => {
      videoSb.remove(start, end);
      audioSb.remove(start, end);
    })
  )
    .ap(maybeToEither(videoSb))
    .ap(maybeToEither(audioSb))
    .error(e => {
      dispatch(
        ACTION.ERROR,
        e.merge(CusError.of(MEDIA_ERROR.SOURCEBUFFER_ERROR))
      );
    });
}

function abortBuffer({ getState, dispatch }) {
  Maybe.of(
    curry((vsb, asb) => {
      dispatch(ACTION.BUFFER.AUDIO_SOURCEBUFFER, null);
      dispatch(ACTION.BUFFER.VIDEO_SOURCEBUFFER, null);
      vsb.abort();
      asb.abort();
    })
  )
    .ap(getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER))
    .ap(getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER));
}

_afterAppended = curry(_afterAppended);
_bindSourceBufferEvent = curry(_bindSourceBufferEvent);
_createSourceBuffer = curry(_createSourceBuffer);

startBuffer = curry(startBuffer);
flushBuffer = curry(flushBuffer);
abortBuffer = curry(abortBuffer);
export { startBuffer, flushBuffer, abortBuffer };

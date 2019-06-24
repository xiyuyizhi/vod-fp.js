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
import { bufferDump } from './buffer-helper';
import { MEDIA_ERROR } from '../error';

const { map, compose, curry, join, chain, prop, trace } = F;

let logger = new Logger('player');

function _bindSourceBufferEvent({ connect, getState, dispatch }, type, sb) {
  const _waitFinished = (other, me) => {
    map(x => {
      if (x === true) {
        // video audio all append
        connect(afterAppended)(true);
      } else {
        dispatch(me, true);
      }
    })(getState(other));
  };
  sb.addEventListener('updateend', function(_) {
    if (type === 'video') {
      getState(ACTION.BUFFER.VIDEO_BUFFER).map(x => {
        if (x.combine) {
          _waitFinished(
            ACTION.BUFFER.AUDIO_APPENDED,
            ACTION.BUFFER.VIDEO_APPENDED
          );
        } else {
          connect(afterAppended)(false);
        }
      });
    }
    if (type === 'audio') {
      getState(ACTION.BUFFER.VIDEO_BUFFER).map(x => {
        if (x.combine) {
          _waitFinished(
            ACTION.BUFFER.VIDEO_APPENDED,
            ACTION.BUFFER.AUDIO_APPENDED
          );
        } else {
          connect(afterAppended)(false);
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

function afterAppended({ getState, dispatch, connect }, combine) {
  dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDED);
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);

  let segBound;
  if (!combine) {
    segBound = getState(ACTION.BUFFER.VIDEO_BUFFER).getOrElse(() => {
      return getState(ACTION.BUFFER.AUDIO_BUFFER).value();
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
      .ap(getState(ACTION.BUFFER.VIDEO_BUFFER))
      .ap(getState(ACTION.BUFFER.AUDIO_BUFFER));
  }

  Maybe.of(
    curry((segments, currentId, media) => {
      let start = parseFloat((segBound.startPTS / 90000).toFixed(6));
      let end = parseFloat((segBound.endPTS / 90000).toFixed(6));
      segments[currentId].start = start;
      segments[currentId].end = end;
      segments[currentId].duration = end - start;

      connect(checkManualSeek)(start);
      logger.log(
        'new buffer:',
        [start, end],
        bufferDump(getState(ACTION.MEDIA.MEDIA_ELE))
      );
      let len = segments.length - 1;
      for (let i = currentId + 1; i <= len; i++) {
        segments[i].start = segments[i - 1].end;
        segments[i].end = parseFloat(
          (segments[i].start + segments[i].duration).toFixed(6)
        );
      }
      //清除无用元素
      dispatch(ACTION.BUFFER.VIDEO_BUFFER_REMOVE);
      dispatch(ACTION.BUFFER.AUDIO_BUFFER_REMOVE);
      dispatch(ACTION.PROCESS, PROCESS.IDLE);
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))
    .ap(getState(ACTION.MEDIA.MEDIA_ELE));
}
afterAppended = curry(afterAppended);

// (Maybe,string,string)  -> (sourcebuffer or undefined)
function createSourceBuffer({ dispatch, connect }, mediaSource, type, mime) {
  logger.log('create source buffer with mime: ', mime);
  return maybeToEither(mediaSource)
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
    })
    .join();
}
createSourceBuffer = curry(createSourceBuffer);

function startBuffer({ id, getState, subscribe, dispatch, connect }) {
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);
  // (Either,Maybe) -> Either
  let doAppend = (sb, bufferInfo) => {
    return Success.of(
      curry((sb, buffer) => {
        sb.appendBuffer(buffer);
      })
    )
      .ap(sb)
      .ap(
        compose(
          maybeToEither,
          map(prop('buffer'))
        )(bufferInfo)
      );
  };

  createSourceBuffer = connect(createSourceBuffer);

  subscribe(ACTION.BUFFER.VIDEO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'video',
        'video/mp4; codecs="avc1.42E01E"'
      );
    });
    doAppend(maybeToEither(Maybe.of(sb)), bufferInfo).error(e => {
      if (e) {
        dispatch(
          ACTION.ERROR,
          e.merge(CusError.of(MEDIA_ERROR.SOURCEBUFFER_ERROR))
        );
      }
    });
  });

  subscribe(ACTION.BUFFER.AUDIO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'audio',
        'video/mp4; codecs="mp4a.40.2"'
      );
    });
    maybe(
      () => {},
      () => {
        dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDING);
      },
      bufferInfo
    );
    doAppend(maybeToEither(Maybe.of(sb)), bufferInfo).error(e => {
      if (e) {
        dispatch(
          ACTION.ERROR,
          e.merge(CusError.of(MEDIA_ERROR.SOURCEBUFFER_ERROR))
        );
      }
    });
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

_bindSourceBufferEvent = curry(_bindSourceBufferEvent);
startBuffer = curry(startBuffer);
flushBuffer = curry(flushBuffer);
export { startBuffer, flushBuffer };

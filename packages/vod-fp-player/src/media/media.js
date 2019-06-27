import {
  Task,
  F,
  Maybe,
  Success,
  CusError,
  maybeToEither,
  Logger
} from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { isSupportMS } from '../utils/probe';
import { abortCurrentSegment } from '../playlist/segment';
import { getBufferInfo } from '../buffer/buffer-helper';
import { SUPPORT_ERROR } from '../error';

const { map, compose, curry, prop, trace } = F;
let logger = new Logger('player');

function _bindMediaEvent(
  { getState, getConfig, dispatch, connect, subscribe },
  media
) {
  let endStreamTolerance = getConfig(ACTION.CONFIG.END_STREAM_TOLERANCE);
  let ms = getState(ACTION.MEDIA.MEDIA_SOURCE);
  media.addEventListener('playing', () => {
    dispatch(ACTION.MAIN_LOOP_HANDLE, 'resume');
  });
  media.addEventListener('seeking', () => {
    logger.log('start seek...', media.currentTime);
    let rest = connect(getBufferInfo)(false);
    if (media.duration - rest.bufferEnd >= endStreamTolerance) {
      dispatch(ACTION.MAIN_LOOP_HANDLE, 'resume');
    } else if (ms.join().readyState === 'open') {
      ms.endOfStream();
      dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
    }
    if (rest.bufferLength === 0) {
      connect(abortCurrentSegment);
    }
  });
  media.addEventListener('seeked', () => {
    logger.log('seek end , can play', media.currentTime);
  });
  media.addEventListener('waiting', () => {
    logger.log('waiting....,is seeking?', media.seeking);
    media.currentTime += getConfig(ACTION.CONFIG.MANUAL_SEEK);
  });
  media.addEventListener('ended', () => {
    logger.log('end....');
  });

  subscribe(ACTION.EVENTS.ERROR, () => {
    getState(ACTION.MEDIA.MEDIA_SOURCE).map(ms => {
      if (ms.readyState === 'open') {
        ms.endOfStream();
      }
    });
  });

  subscribe(ACTION.PROCESS, process => {
    let rest = connect(getBufferInfo)(false);
    Success.of(
      curry((proce, mediaSource, currentId) => {
        if (
          proce === PROCESS.IDLE &&
          media.duration - rest.bufferEnd <= endStreamTolerance &&
          mediaSource.readyState === 'open'
        ) {
          logger.warn('end of stream');
          mediaSource.endOfStream();
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1);
          dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
        }
      })
    )
      .ap(maybeToEither(process))
      .ap(maybeToEither(ms))
      .ap(maybeToEither(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID)))
      .error(e => {
        logger.log(e);
      });
  });
}

function createMediaSource({ connect, dispatch, subscribe }, media) {
  if (isSupportMS()) {
    const mediaSource = new MediaSource();
    media.src = URL.createObjectURL(mediaSource);
    dispatch(ACTION.MEDIA.MEDIA_SOURCE, mediaSource);
    connect(_bindMediaEvent)(media);
    return Task.of(mediaSource);
  }
  return Task.reject(CusError.of(SUPPORT_ERROR.NOT_SUPPORT_MSE));
}

function destroyMediaSource({ getState, dispatch }) {
  getState(ACTION.MEDIA.MEDIA_ELE).map(media => {
    URL.revokeObjectURL(media.src);
    media.removeAttribute('src')
    media.load()
    dispatch(ACTION.MEDIA.MEDIA_SOURCE, null)
  })
}

function updateMediaDuration({ getState }) {
  Maybe.of(
    F.curry((ms, duration) => {
      if (ms.readyState === 'open') {
        ms.duration = duration;
      }
    })
  )
    .ap(getState(ACTION.MEDIA.MEDIA_SOURCE))
    .ap(getState(ACTION.PLAYLIST.DURATION));
}

function checkManualSeek({ getConfig, getState }, start) {
  getState(ACTION.MEDIA.MEDIA_ELE).map(media => {
    if (
      media.seeking &&
      Math.abs(start - media.currentTime) <
      getConfig(ACTION.CONFIG.MAX_FRGA_LOOKUP_TOLERANCE)
    ) {
      logger.warn('当前位于分片最末尾,append的是后一个分片,需要seek一下');
      media.currentTime += getConfig(ACTION.CONFIG.MANUAL_SEEK);
    }
  });
}

_bindMediaEvent = curry(_bindMediaEvent);
createMediaSource = curry(createMediaSource);
destroyMediaSource = curry(destroyMediaSource);
updateMediaDuration = curry(updateMediaDuration);
checkManualSeek = curry(checkManualSeek);
export { createMediaSource, destroyMediaSource, updateMediaDuration, checkManualSeek };

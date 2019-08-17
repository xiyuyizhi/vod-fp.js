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
import { abortLoadingSegment } from '../playlist/segment';
import { SUPPORT_ERROR } from '../error';

const { map, compose, curry, prop, trace } = F;
let logger = new Logger('player');

function _bindMediaEvent(
  { getState, getConfig, dispatch, connect, subscribe },
  media
) {
  let endStreamTolerance = getConfig(ACTION.CONFIG.END_STREAM_TOLERANCE);
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);

  media.addEventListener('playing', () => {
    dispatch(ACTION.MAIN_LOOP_HANDLE, 'resume');
  });

  media.addEventListener('seeking', () => {
    logger.log('start seek...', media.currentTime);

    let rest = getState(ACTION.BUFFER.GET_BUFFER_INFO);

    Maybe.of(
      curry((bufferInfo, ms) => {
        if (media.duration - bufferInfo.bufferEnd >= endStreamTolerance) {
          dispatch(ACTION.MAIN_LOOP_HANDLE, 'resume');
        } else if (
          ms.readyState === 'open' &&
          !getState(ACTION.PLAYLIST.IS_LIVE).value()
        ) {
          ms.endOfStream();
          dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
        }
      })
    )
      .ap(rest)
      .ap(mediaSource);

    rest.map(buffer => {
      if (buffer.bufferLength === 0 || buffer.bufferEnd === 0) {
        connect(abortLoadingSegment);
      }
    });
  });

  media.addEventListener('seeked', () => {
    logger.log('seek end , can play', media.currentTime);
  });

  media.addEventListener('waiting', () => {
    logger.log('waiting....,is seeking?', media.seeking);
    if (media.seeking) return;
    media.currentTime += getConfig(ACTION.CONFIG.MANUAL_SEEK);
  });

  media.addEventListener('ended', () => {
    logger.log('end....');
    dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
  });

  subscribe(ACTION.EVENTS.ERROR, () => {
    getState(ACTION.MEDIA.MEDIA_SOURCE).map(ms => {
      if (ms.readyState === 'open') {
        ms.endOfStream();
      }
    });
  });

  // check EOS
  subscribe(PROCESS.IDLE, () => {
    getState(ACTION.PLAYLIST.IS_LIVE).getOrElse(() => {
      let rest = getState(ACTION.BUFFER.GET_BUFFER_INFO).join();
      maybeToEither(mediaSource)
        .map(x => {
          if (
            media.duration - rest.bufferEnd <= endStreamTolerance &&
            x.readyState === 'open'
          ) {
            logger.warn('end of stream');
            x.endOfStream();
            dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
          }
        })
        .error(e => {
          logger.log(e);
        });
    });
  });
}

function createMediaSource({ connect, dispatch, subscribe }, media) {
  if (isSupportMS()) {
    const mediaSource = new MediaSource();
    if (media.src) {
      window.URL.revokeObjectURL(media.src);
      media.removeAttribute('src');
      media.load();
    }
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
    media.removeAttribute('src');
    media.load();
    dispatch(ACTION.MEDIA.MEDIA_SOURCE, null);
  });
}

function updateMediaDuration({ getState }) {
  Maybe.of(
    F.curry((ms, duration) => {
      let vsb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(null);
      let asb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(null);
      if (vsb && vsb.updating) return;
      if (asb && asb.updating) return;
      if (ms.readyState === 'open') {
        ms.duration = duration;
      }
    })
  )
    .ap(getState(ACTION.MEDIA.MEDIA_SOURCE))
    .ap(getState(ACTION.PLAYLIST.DURATION));
}

/**
 *
 * @param {number} start  the next segment.start
 */
function checkManualSeek({ getConfig, getState }, start) {
  getState(ACTION.MEDIA.MEDIA_ELE).map(media => {
    if (
      media.seeking &&
      start > media.currentTime &&
      start - media.currentTime <=
        getConfig(ACTION.CONFIG.MAX_FRAG_LOOKUP_TOLERANCE)
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
export {
  createMediaSource,
  destroyMediaSource,
  updateMediaDuration,
  checkManualSeek
};

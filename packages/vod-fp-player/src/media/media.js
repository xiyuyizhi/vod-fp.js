import { Task, F, Maybe, Success, maybeToEither } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { isSupportMS } from '../utils/probe';
import { abortCurrentSegment } from '../playlist/segment';
import { getBufferInfo } from '../buffer/buffer-helper';

const { map, compose, curry, prop, trace } = F;

function bindMediaEvent({ getState, dispatch, connect, subscribe }, media) {
  media.addEventListener('seeking', () => {
    console.log('start seek...', media.currentTime);
    map(x => {
      if (x === PROCESS.SEGMENT_LOADING) {
        connect(abortCurrentSegment);
      }
    })(getState(ACTION.PROCESS));
  });
  media.addEventListener('seeked', () => {
    console.log('seek end , can play');
  });
  media.addEventListener('waiting', () => {
    console.log('waiting....');
    media.currentTime += 0.1;
  });
  media.addEventListener('ended', () => {
    console.log('end....');
  });

  subscribe(ACTION.PROCESS, process => {
    let rest = connect(getBufferInfo)(false);
    Success.of(
      curry((proce, mediaSource, segmentsLen, currentId) => {
        if (
          proce === PROCESS.IDLE &&
          media.duration - rest.bufferEnd <= 0.2 &&
          mediaSource.readyState === 'open'
        ) {
          console.warn('end of stream');
          mediaSource.endOfStream();
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1);
        }
      })
    )
      .ap(maybeToEither(process))
      .ap(maybeToEither(getState(ACTION.MEDIA.MEDIA_SOURCE)))
      .ap(maybeToEither(getState(ACTION.PLAYLIST.SEGMENTS_LEN)))
      .ap(maybeToEither(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID)))
      .error(e => {
        console.log(e);
      });
  });
}
bindMediaEvent = curry(bindMediaEvent);

function createMediaSource({ connect, dispatch, subscribe }, media) {
  if (isSupportMS()) {
    const mediaSource = new MediaSource();
    media.src = URL.createObjectURL(mediaSource);
    dispatch(ACTION.MEDIA.MEDIA_SOURCE, mediaSource);
    connect(bindMediaEvent)(media);
    return Task.of(mediaSource);
  }
  return Task.reject('browser not support MSE');
}

function updateMediaDuration({ getState }) {
  Maybe.of(
    F.curry((ms, duration) => {
      ms.duration = duration;
    })
  )
    .ap(getState(ACTION.MEDIA.MEDIA_SOURCE))
    .ap(getState(ACTION.PLAYLIST.DURATION));
}

createMediaSource = curry(createMediaSource);
updateMediaDuration = curry(updateMediaDuration);
export { createMediaSource, updateMediaDuration };
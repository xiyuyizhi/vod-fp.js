import { Task, F, Maybe, Success, maybeToEither } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { isSupportMS } from '../utils/probe';
import { abortCurrentSegment } from "../playlist/segment"

const { map, compose, curry, trace } = F

function bindMediaEvent({ getState, dispatch, connect, subscribe }, media) {

  media.addEventListener('seeking', () => {
    map(x => {
      if (x === PROCESS.SEGMENT_LOADING) {
        connect(abortCurrentSegment)
      };
    })(getState(ACTION.PROCESS))
    console.log('start seek...', media.currentTime);
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

  subscribe(ACTION.PROCESS, (process) => {
    Success.of(curry((proce, mediaSource, segmentsLen, currentId) => {
      if (proce === PROCESS.IDLE && currentId === segmentsLen - 1) {
        if (mediaSource.readyState === 'open') {
          console.warn('end of stream')
          mediaSource.endOfStream()
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1)
        }
      }
    })).ap(maybeToEither(process))
      .ap(maybeToEither(getState(ACTION.MEDIA.MEDIA_SOURCE)))
      .ap(maybeToEither(getState(ACTION.PLAYLIST.SEGMENTS_LEN)))
      .ap(maybeToEither(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID)))
      .error(e => {
        console.log(e)
      })

  })

}
bindMediaEvent = curry(bindMediaEvent)

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
  Maybe.of(F.curry((ms, duration) => {
    ms.duration = duration
  })).ap(getState(ACTION.MEDIA.MEDIA_SOURCE))
    .ap(getState(ACTION.PLAYLIST.DURATION))
}

createMediaSource = curry(createMediaSource)
updateMediaDuration = curry(updateMediaDuration)
export {
  createMediaSource,
  updateMediaDuration
};

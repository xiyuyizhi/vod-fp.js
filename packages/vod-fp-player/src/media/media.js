import { Task, F, Maybe, Success } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { isSupportMS } from '../utils/probe';

const { map, compose, curry, trace } = F

function abortCurrentSegment({ getState }) {
  Success.of(F.curry((abortables, currentSegment) => {
    let a = abortables.filter(x => x.id === currentSegment.url)[0]
    if (a) {
      a.abortAble.abort()
    }
  }))
    .ap(getState(ACTION.ABORTABLE))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT))
}

function bindMediaEvent({ getState, connect }, media) {
  media.addEventListener('waiting', e => {
    media.currentTime += 0.01;
  });
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
    media.currentTime += 0.05;
  });
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

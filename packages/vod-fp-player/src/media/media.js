import { Task, F } from 'vod-fp-utility';
import { ACTION } from '../store';
import { isSupportMS } from '../utils/probe';

function bindMediaEvent(media) {
  media.addEventListener('waiting', e => {
    media.currentTime += 0.01;
  });
  media.addEventListener('seeking', () => {
    console.log('start seek...', media.currentTime);
  });
  media.addEventListener('seeked', () => {
    console.log('seek end , can play');
  });
  media.addEventListener('waiting', () => {
    console.log('waiting....');
    media.currentTime += 0.2;
  });
}

function createMediaSource({ dispatch }, media) {
  if (isSupportMS()) {
    const mediaSource = new MediaSource();
    media.src = URL.createObjectURL(mediaSource);
    dispatch(ACTION.MEDIA.MEDIA_SOURCE, mediaSource);
    bindMediaEvent(media);
    return Task.of(mediaSource);
  }
  return Task.reject('not support');
}

export default F.curry(createMediaSource);

import { Task, F } from 'vod-fp-utility';
import { ACTION } from '../store';
import { isSupportMS } from '../utils/probe';

function bindMediaEvent(media) {}

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

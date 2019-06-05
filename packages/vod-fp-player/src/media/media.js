import { Task, F } from 'vod-fp-utility';
import { connect, ACTION } from '../store';
import { isSupportMS } from '../utils/probe';

function bindMediaEvent(media) {}

function createMediaSource({ dispatch }, media) {
  if (isSupportMS()) {
    const mediaSource = new MediaSource();
    media.src = URL.createObjectURL(mediaSource);
    dispatch(ACTION.MEDIA_SOURCE_CREATE, mediaSource);
    bindMediaEvent(media);
    return Task.of(2);
  }
  return Task.reject('not support');
}
createMediaSource = connect(F.curry(createMediaSource));
export { createMediaSource };

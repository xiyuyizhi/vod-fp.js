import { F } from 'vod-fp-utility';
import { ACTION } from '../store';

function buffer({ id, getState }, currentTime) {
  console.log('store是否正确?', id, currentTime);
  console.log('mediaSource', getState(ACTION.MEDIA.MEDIA_SOURCE));
}

buffer = F.curry(buffer);

export { buffer };

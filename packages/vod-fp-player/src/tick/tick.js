import { F } from 'vod-fp-utility';
import { ACTION } from '../store';

function tick({ getState }, a, b) {
  console.log(getState(ACTION.MEDIA.MEDIA_SOURCE));
  console.log(getState(ACTION.PLAYLIST.PLAYLIST));
  console.log(getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID));
  console.log(getState(ACTION.PLAYLIST.CURRENT_LEVEL));
  console.log(a, b);
}

const startTick = F.curry(tick);

export { startTick };

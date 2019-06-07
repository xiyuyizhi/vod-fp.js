import { combineActions, combineStates, createStore } from 'vod-fp-utility';
import playlist from './playlist';
import media from './media';

let ACTION = {
  ERROR: 'error',
  M3U8_URL: 'm3u8Url'
};

let initState = {
  error: null,
  m3u8Url: ''
};

ACTION = combineActions(ACTION, playlist, media);
initState = combineStates(initState, playlist, media);

console.log(ACTION);
export { createStore, initState, ACTION };

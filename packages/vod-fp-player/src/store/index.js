import { combineActions, combineStates, createStore } from 'vod-fp-utility';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';

let PROCESS = {
  IDLE: 'idle',
  PLAYLIST_LOADING: 'playlistLoading',
  PAYLIST_LOADED: 'playlistLoaded',
  SEGMENT_LOADING: 'segmentLoading',
  SEGMENT_LOADED: 'segmentLoaded',
  BUFFER_APPENDING: 'bufferAppending',
  BUFFER_APPENDED: 'bufferAppended',
  ABORT: 'ABORT'
};

let ACTION = {
  ERROR: 'error',
  M3U8_URL: 'm3u8Url',
  MUX: 'mux',
  PROCESS: 'process'
};

let initState = {
  error: null,
  m3u8Url: '',
  mux: null,
  process: PROCESS.IDLE
};

ACTION = combineActions(ACTION, playlist, media, buffer);
initState = combineStates(initState, playlist, media, buffer);

console.log(ACTION);
export { createStore, initState, ACTION, PROCESS };

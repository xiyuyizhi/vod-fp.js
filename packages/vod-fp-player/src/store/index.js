import { combineActions, combineStates, createStore } from 'vod-fp-utility';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';
import { map, prop } from '../../../vod-fp-utility/src/fp/core';

let PROCESS = {
  IDLE: 'idle',
  PLAYLIST_LOADING: 'playlistLoading',
  PAYLIST_LOADED: 'playlistLoaded',
  SEGMENT_LOADING: 'segmentLoading',
  SEGMENT_LOADED: 'segmentLoaded',
  BUFFER_APPENDING: 'bufferAppending',
  ABORT: 'ABORT'
};

let ACTION = {
  ERROR: 'error',
  M3U8_URL: 'm3u8Url',
  MUX: 'mux',
  PROCESS: 'process',
  ABORTABLE: 'abortAble',
  REMOVE_ABORTABLE: 'removeAbortAble'
};

let initState = {
  error: null,
  m3u8Url: '',
  mux: null,
  abortAble: [],
  process: PROCESS.IDLE,
  derive: {
    abortAble(state, payload) {
      if (!payload) {
        return map(prop('abortAble'))(state)
      }
      return map(x => {
        x.abortAble = x.abortAble.concat([payload])
        return x;
      })(state)
    },
    removeAbortAble(state, payload) {
      if (payload !== undefined) {
        return map(x => {
          x.abortAble = x.abortAble.filter(x => x.id === payload)
          return x;
        })(state)
      }
    }
  }
};

ACTION = combineActions(ACTION, playlist, media, buffer);
initState = combineStates(initState, playlist, media, buffer);

console.log(ACTION);
export { createStore, initState, ACTION, PROCESS };

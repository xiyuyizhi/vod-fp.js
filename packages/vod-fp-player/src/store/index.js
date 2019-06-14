import { combineActions, combineStates, createStore, F } from 'vod-fp-utility';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';

const { map, prop } = F;

let PROCESS = {
  IDLE: 'idle',
  PLAYLIST_LOADING: 'playlistLoading',
  PAYLIST_LOADED: 'playlistLoaded',
  SEGMENT_LOADING: 'segmentLoading',
  SEGMENT_LOADED: 'segmentLoaded',
  MUXING: 'muxing',
  MUXED: 'muxed',
  BUFFER_APPENDING: 'bufferAppending',
  BUFFER_APPENDED: 'bufferAppended',
  ABORT: 'abort',
  ERROR: 'error'
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
  timeStamp: performance.now(),
  process: PROCESS.IDLE,
  derive: {
    error(state, payload) {
      if (payload) {
        console.log('Error', payload);
        return map(x => {
          x.error = payload;
          return x;
        })(state);
      }
    },
    abortAble(state, payload) {
      if (!payload) {
        return map(prop('abortAble'))(state);
      }
      return map(x => {
        x.abortAble = x.abortAble.concat([payload]);
        return x;
      })(state);
    },
    removeAbortAble(state, payload) {
      if (payload !== undefined) {
        return map(x => {
          x.abortAble = [];
          return x;
        })(state);
      }
    },
    process(state, payload, type = '') {
      if (payload) {
        const { timeStamp, process } = state.value();
        let ts = (performance.now() - timeStamp).toFixed(2);
        console.log(
          `PROCESS: ${state.value().process}(${ts} ms) -> ${payload}${
            type ? '[' + type + ']' : ''
          }`
        );
        return map(x => {
          x.timeStamp = performance.now();
          x.process = payload;
          return x;
        })(state);
      }
      return map(prop('process'))(state);
    }
  }
};

ACTION = combineActions(ACTION, playlist, media, buffer);
initState = combineStates(initState, playlist, media, buffer);

console.log(ACTION);
export { createStore, initState, ACTION, PROCESS };

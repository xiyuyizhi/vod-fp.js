import { combineActions, combineStates, createStore, F } from 'vod-fp-utility';
import EVENTS from '../events';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';

const { map, prop, compose, trace } = F;

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
  EVENTS,
  M3U8_URL: 'm3u8Url',
  MUX: 'mux',
  PROCESS: 'process',
  ABORTABLE: 'abortAble',
  REMOVE_ABORTABLE: 'removeAbortAble',
  MAIN_LOOP: 'mainLoop',
  MAIN_LOOP_HANDLE: 'mainLoopHandle'
};

/**
 *
 * state存放状态,所有跨文件需要定义的状态全部存放到公共地方 store。
 * 对状态的使用只能通过getState()！！获取。
 * 对状态的修改、操作只能通过dispatch(ACTION)！！操作。
 * 对状态的操作定义只能声明在state.derive中！！。
 * 各个模块需要接触state的function都必须是curry化的！！,第一个参数必须是_store对象。
 */
let initState = {
  error: null,
  m3u8Url: '',
  mux: null,
  mainLoop: null,
  abortAble: [],
  timeStamp: performance.now(),
  process: PROCESS.IDLE,
  // derive属性包括、对声明在stata中的某个【同名】属性的修改、查询或者只是对某个属性的操作
  derive: {
    error(state, payload) {
      if (payload) {
        console.log('Error log:', payload);
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
    process(state, payload, dispatch) {
      if (payload) {
        // dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
        const { timeStamp, process } = state.value();
        let ts = (performance.now() - timeStamp).toFixed(2);
        console.log(
          `PROCESS: ${state.value().process}(${ts} ms) -> ${payload}`
        );
        return map(x => {
          x.timeStamp = performance.now();
          x.process = payload;
          return x;
        })(state);
      }
      return map(prop('process'))(state);
    },
    mainLoopHandle(state, payload) {
      if (payload === 'stop') {
        compose(
          map(tick => tick.stop()),
          map(prop('mainLoop'))
        )(state);
      }
      if (payload === 'resume') {
        compose(
          map(tick => tick.immediate()),
          map(prop('mainLoop'))
        )(state);
      }
    }
  }
};

ACTION = combineActions(ACTION, playlist, media, buffer);
initState = combineStates(initState, playlist, media, buffer);

console.log(ACTION);
export { createStore, initState, ACTION, PROCESS };

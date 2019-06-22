import { combineActions, combineStates, createStore, F } from 'vod-fp-utility';
import EVENTS from '../events';
import config from './config';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';
const { map, prop, compose, trace } = F;

let PROCESS = {
  IDLE: 'idle',
  PLAYLIST_LOADING: 'playlistLoading',
  PLAYLIST_LOADED: 'playlistLoaded',
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
  ERROR: 'innerError',
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
  errorCount: 0,
  m3u8Url: '',
  mux: null,
  mainLoop: null,
  abortAble: [],
  timeStamp: performance.now(),
  process: PROCESS.IDLE,
  // derive属性包括、对声明在stata中的某个【同名】属性的修改、查询或者只是对某个属性的操作
  derive: {
    innerError(state, payload, dispatch) {
      if (payload) {
        console.log('Error log:', payload);
        function _handleError(s) {
          if (s.errorCount >= 3 || s.error.value().fatal === true) {
            console.log('error occur many times.....,emit error out');
            s.errorCount = 0;
            s.error.fatal(true);
            dispatch(ACTION.EVENTS.ERROR, s.error.value());
            dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
          } else {
            // 可恢复、继续运行
            dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1);
            dispatch(ACTION.PROCESS, PROCESS.IDLE);
          }
          return s;
        }

        return compose(
          map(_handleError),
          map(x => {
            x.error = payload;
            x.errorCount += 1;
            return x;
          })
        )(state);
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
        return compose(
          map(s => {
            if (s.process === PROCESS.BUFFER_APPENDED) {
              s.errorCount = 0;
            }
            return s;
          }),
          map(x => {
            x.timeStamp = performance.now();
            x.process = payload;
            return x;
          })
        )(state);
      }
      return map(prop('process'))(state);
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
          x.abortAble = x.abortAble.filter(x => x.id !== payload);
          return x;
        })(state);
      }
    },
    mainLoopHandle(state, payload) {
      if (payload === 'stop') {
        console.log('timer stoped');
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

ACTION = combineActions(ACTION, config, playlist, media, buffer);
initState = combineStates(initState, config, playlist, media, buffer);

console.log(ACTION);
export { createStore, initState, ACTION, PROCESS };

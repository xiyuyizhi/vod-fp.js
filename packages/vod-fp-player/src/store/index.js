import {
  Logger,
  combineActions,
  combineStates,
  createStore,
  F
} from 'vod-fp-utility';
import EVENTS from '../events';
import config from './config';
import playlist from './playlist';
import media from './media';
import buffer from './buffer';
import flyBuffer from './flyBuffer';
import abr from "./abr"
import loadInfo from "./loadInfo"

const { map, prop, compose, trace } = F;
let logger = new Logger('player');

let PROCESS = {
  IDLE: 'idle',
  PLAYLIST_LOADING: 'playlistLoading',
  PLAYLIST_LOADED: 'playlistLoaded',
  INIT_MP4_LOADING: 'initMp4Loading',
  INIT_MP4_LOADED: 'initMp4Loaded',
  MUXING: 'muxing',
  MUXED: 'muxed',
  BUFFER_APPENDING: 'bufferAppending',
  BUFFER_APPENDED: 'bufferAppended',
  LEVEL_CHANGING: 'levelChanging',
  LEVEL_CHANGED: 'levelChanged'
};

let LOADPROCESS = {
  IDLE: 'idle',
  SEGMENT_LOADING: 'segmentLoading',
  SEGMENT_LOADED: 'segmentLoaded',
  SEGMENT_LOAD_ABORT: 'segmentLoadAbort',
  SEGMENT_LOAD_ERROR: 'segmentLoadError'
};

let ACTION = {
  EVENTS,
  ERROR: 'innerError',
  M3U8_URL: 'm3u8Url',
  MUX: 'mux',
  PROCESS: 'process',
  LOADPROCESS: 'loadProcess',
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
function getGlobalState() {
  return {
    innerError: null,
    errorCount: 0,
    m3u8Url: '',
    mux: null,
    mainLoop: null,
    process: PROCESS.IDLE,
    loadProcess: LOADPROCESS.IDLE,
    abortAble: [],
    processTs: performance.now(),
    loadProcessTs: performance.now(),
    // derive属性包括、对声明在stata中的某个【同名】属性的修改、查询或者只是对某个属性的操作
    derive: {
      innerError(state, payload, { dispatch }) {
        if (payload) {
          logger.log('Error log:', payload);
          function _handleError(s) {
            if (s.errorCount >= 3 || s.error.value().fatal === true) {
              logger.log('error occur many times.....,emit error out');
              s.errorCount = 0;
              s.error.fatal(true);
              dispatch(ACTION.EVENTS.ERROR, s.error.value());
              dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
              if (s.mux) {
                global.URL.revokeObjectURL(s.mux.objectURL);
              }
            } else {
              // 可恢复、继续运行
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
      process(state, payload, { dispatch }) {
        if (payload) {
          const { processTs, process } = state.value();
          let ts = (performance.now() - processTs).toFixed(2);
          logger.log(`PROCESS: ${process}(${ts} ms) -> ${payload}`);
          let s = compose(
            map(s => {
              if (s.process === PROCESS.BUFFER_APPENDED) {
                s.errorCount = 0;
              }
              return s;
            }),
            map(x => {
              x.processTs = performance.now();
              x.process = payload;
              return x;
            })
          )(state);
          dispatch(payload);
          return s;
        }
        return map(prop('process'))(state);
      },
      loadProcess(state, payload, { dispatch }) {
        if (payload) {
          const { loadProcessTs, loadProcess } = state.value();
          let ts = (performance.now() - loadProcessTs).toFixed(2);
          logger.log(`LOAD_PROCESS: ${loadProcess}(${ts} ms) -> ${payload}`);
          dispatch(payload)
          return state.map(x => {
            x.loadProcessTs = performance.now();
            x.loadProcess = payload;
            return x;
          });
        }
        return map(prop('loadProcess'))(state);
      },
      abortAble(state, payload) {
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
        } else {
          return map(x => {
            x.abortAble.forEach(abortAble => {
              abortAble.task.abort();
            });
            x.abortAble = [];
            return x;
          })(state);
        }
      },
      mainLoopHandle(state, payload) {
        if (payload === 'stop') {
          logger.log('timer stoped');
          compose(
            map(tick => tick.stop()),
            map(prop('mainLoop'))
          )(state);
        }
        if (payload === 'resume') {
          logger.log('timer resume');
          compose(
            map(tick => tick.resume()),
            map(prop('mainLoop'))
          )(state);
        }
      }
    }
  };
}

ACTION = combineActions(ACTION, config, playlist, media, buffer, flyBuffer, abr, loadInfo);

function getInitState() {
  return combineStates(
    { getState: getGlobalState },
    config,
    playlist,
    media,
    buffer,
    flyBuffer,
    abr,
    loadInfo
  );
}
export { createStore, getInitState, ACTION, PROCESS, LOADPROCESS };

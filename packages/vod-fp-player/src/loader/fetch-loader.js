import { Task, Fail, CusError, F } from 'vod-fp-utility';
import { ACTION } from '../store';
import { LOADER_ERROR } from '../error';

const { curry } = F;

const FETCH_BODY = {
  text: 'text',
  arraybuffer: 'arrayBuffer',
  json: 'json',
  blob: 'blob'
};

function _readerStream({ dispatch }, reader, headers) {
  let store = [];
  let tsStart;
  let lastTs;
  let caclSize = arr =>
    arr.reduce((all, c) => {
      all += c.byteLength;
      return all;
    }, 0);
  let dump = () => {
    if (!tsStart) {
      lastTs = tsStart = performance.now();
    }
    return reader.read().then(({ done, value }) => {
      if (done) {
        let totalLength = caclSize(store);
        let uint8Array = new Uint8Array(totalLength);
        let offset = 0;
        store.forEach(bf => {
          uint8Array.set(bf, offset);
          offset += bf.byteLength;
        });
        store = [];
        return {
          buffer: uint8Array.buffer,
          info: {
            tsLoad: performance.now() - tsStart,
            size: totalLength
          }
        };
      }
      store.push(value);
      let tsTick = performance.now() - lastTs;
      //单次时间 > 1ms 有效
      if (tsTick >= 1.2) {
        dispatch(
          ACTION.LOADINFO.COLLECT_DOWNLOAD_SPEED,
          value.byteLength / tsTick / 1000
        );
        dispatch(ACTION.LOADINFO.CURRENT_SEG_DONWLOAD_INFO, {
          loaded: caclSize(store),
          total: +headers.get('Content-Length'),
          tsRequest: performance.now() - tsStart
        });
      }
      lastTs = performance.now();
      return dump();
    });
  };
  return dump();
}
_readerStream = curry(_readerStream);

function fetchLoader(
  { connect, dispatch },
  config,
  controller,
  resolve,
  reject
) {
  let { url, body, method, headers, options, params } = config;
  let cancelTimer;
  if (params.timeout) {
    cancelTimer = setTimeout(() => {
      console.warn('TIMEOUT');
      reject(CusError.of(LOADER_ERROR.LOAD_TIMEOUT));
      controller.abort();
    }, params.timeout);
  }
  let ts = performance.now();

  fetch(url, {
    method,
    headers,
    signal: controller.signal,
    body,
    ...options
  })
    .then(res => {
      if (res.ok && (res.status >= 200 && res.status < 300)) {
        return res;
      }
      reject(
        CusError.of({
          ...LOADER_ERROR.LOAD_ERROR,
          code: res.status,
          message: res.statusText
        })
      );
    })
    .then(res => {
      if (config.useStream) {
        return connect(_readerStream)(res.body.getReader(), res.headers);
      }
      return res[FETCH_BODY[params.responseType]]();
    })
    .then(res => {
      clearTimeout(cancelTimer);
      resolve(res);
    })
    .catch(e => {
      clearTimeout(cancelTimer);
      if (e instanceof DOMException) {
        console.warn('ABORT');
        reject(CusError.of(LOADER_ERROR.ABORT));
        return;
      }
      reject(CusError.of(LOADER_ERROR.LOAD_ERROR));
    });
}

export default curry(fetchLoader);

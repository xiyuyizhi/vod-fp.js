import { Task, Fail, CusError, F } from 'vod-fp-utility';
import { ACTION } from '../store';
import { LOADER_ERROR } from '../error';

const { curry } = F;

function createXhr() {
  let xhr;
  if (window.XMLHttpRequest) {
    xhr = new XMLHttpRequest();
  } else {
    xhr = new ActiveXObject('Microsoft.XMLHTTP');
  }
  return xhr;
}

function xhrLoader({ dispatch }, config, resolve, reject) {
  let xhr = createXhr();
  Object.keys(config.headers).forEach((key) => {
    xhr.setRequestHeader(key, config.headers[key]);
  });

  Object.keys(config.options).forEach((key) => {
    xhr[key] = config.options[key];
  });
  Object.keys(config.params).forEach((key) => {
    console.log(key, config.params[key]);
    xhr[key] = config.params[key];
  });

  xhr.open(config.method, config.url);
  let isBuffer = config.params.responseType === 'arraybuffer';

  if (isBuffer) {
    let tsStart = performance.now();
    xhr.addEventListener('progress', (e) => {
      dispatch(
        ACTION.LOADINFO.COLLECT_DOWNLOAD_SPEED,
        e.loaded / (performance.now() - tsStart) / 1000
      );
      dispatch(ACTION.LOADINFO.CURRENT_SEG_DONWLOAD_INFO, {
        loaded: e.loaded,
        total: e.total,
        tsRequest: performance.now() - tsStart,
      });
    });
  }

  xhr.addEventListener('readystatechange', () => {
    if (xhr.readyState === 4) {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
        if (isBuffer) {
          let byteLength = xhr.response.byteLength;
          resolve({
            buffer: xhr.response,
            info: {
              tsLoad: byteLength,
              size: byteLength,
            },
          });
        } else {
          resolve(xhr.response);
        }
        return;
      }
      if (xhr.status) {
        reject(
          CusError.of({
            ...LOADER_ERROR.LOAD_ERROR,
            code: xhr.status,
            message: xhr.statusText,
          })
        );
      }
    }
  });

  xhr.addEventListener('abort', () => {
    console.warn('ABORT');
    reject(CusError.of(LOADER_ERROR.ABORT));
  });

  xhr.addEventListener('error', (e) => {
    reject(CusError.of(LOADER_ERROR.LOAD_ERROR));
  });

  xhr.addEventListener('timeout', () => {
    console.warn('TIMEOUT');
    reject(CusError.of(LOADER_ERROR.LOAD_TIMEOUT));
  });

  xhr.send(config.body);
  return xhr;
}

export default curry(xhrLoader);

import { Task, Fail, CusError } from 'vod-fp-utility';
import { XHR_ERROR } from '../error';

const DEFAULT_CONFIG = {
  method: 'get',
  url: '',
  body: null,
  headers: {},
  options: {
    responseType: 'text',
    timeout: 0,
    withCredentials: false
  }
}

const FETCH_BODY = {
  text: 'text',
  'arraybuffer': 'arrayBuffer',
  'json': 'json',
  'blob': 'blob'
}

function createXhr() {
  let xhr;
  if (window.XMLHttpRequest) {
    xhr = new XMLHttpRequest();
  } else {
    xhr = new ActiveXObject('Microsoft.XMLHTTP');
  }
  return xhr;
}

function startXhr(config, resolve, reject) {

  let xhr = createXhr();

  Object.keys(config.headers).forEach(key => {
    xhr.setRequestHeader(key, config.headers[key]);
  });
  Object.keys(config.options).forEach(key => {
    xhr[key] = config.options[key];
  });

  xhr.open(config.method, config.url);

  xhr.addEventListener('readystatechange', () => {
    if (xhr.readyState === 4) {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
        resolve(xhr.response);
        return;
      }
      if (xhr.status) {
        reject(
          CusError.of({
            ...XHR_ERROR.LOAD_ERROR,
            code: xhr.status,
            message: xhr.statusText
          })
        );
      }
    }
  });
  xhr.addEventListener('abort', () => {
    console.warn('ABORT');
    reject(CusError.of(XHR_ERROR.ABORT));
  });
  xhr.addEventListener('error', e => {
    reject(CusError.of(XHR_ERROR.LOAD_ERROR));
  });
  xhr.addEventListener('timeout', () => {
    reject(CusError.of(XHR_ERROR.LOAD_TIMEOUT));
  });
  xhr.send(config.body);
  return xhr;
}


function startFetch(config, controller, resolve, reject) {
  let { url, body, method, headers, options } = config;
  let timer;
  if (options.timeout) {
    timer = setTimeout(() => {
      console.warn('TIMEOUT')
      reject(CusError.of(XHR_ERROR.LOAD_TIMEOUT));
      controller.abort();
    }, options.timeout)
  }
  fetch(url, {
    method,
    headers,
    signal: controller.signal,
    body
  })
    .then(res => {
      if (res.ok) {
        return res;
      }
      reject(
        CusError.of({
          ...XHR_ERROR.LOAD_ERROR,
          code: res.status,
          message: res.statusText
        })
      );
    })
    .then(res => res[FETCH_BODY[options.responseType]]())
    .then(res => {
      clearTimeout(timer);
      resolve(res)
    })
    .catch((e) => {
      clearTimeout(timer);
      if (e instanceof DOMException) {
        console.warn('ABORT');
        reject(CusError.of(XHR_ERROR.ABORT))
        return;
      }
      reject(CusError.of(XHR_ERROR.LOAD_ERROR))
    })
}

export default (config, abort) => {
  return Task.of((resolve, reject) => {
    config.options = config.options || DEFAULT_CONFIG.options;
    config = Object.assign({}, DEFAULT_CONFIG, config);
    if (window.fetch && window.AbortController) {
      let controller = new AbortController();
      let signal = controller.signal;
      startFetch(config, controller, resolve, reject)
      abort(controller)
    } else {
      abort(startXhr(config, resolve, reject));
    }
  });
};

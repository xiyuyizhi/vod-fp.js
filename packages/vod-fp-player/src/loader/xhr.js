import { Task, Fail, CusError } from 'vod-fp-utility';
import { XHR_ERROR } from '../error';

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
  config = Object.assign(
    {},
    {
      method: 'get',
      url: '',
      body: null,
      headers: {},
      options: {
        responseType: 'text',
        timeout: 0,
        withCredentials: false
      }
    },
    config
  );

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

export default (data, abort) => {
  return Task.of((resolve, reject) => {
    let xhr = startXhr(data, resolve, reject);
    abort(xhr);
  });
};

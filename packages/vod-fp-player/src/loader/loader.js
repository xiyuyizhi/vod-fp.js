import { Task } from 'vod-fp-utility';

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
        reject({
          code: xhr.status,
          message: xhr.statusText
        });
      }
    }
  });
  xhr.addEventListener('abort', () => {
    console.warn('Abort');
    reject({
      code: 0,
      message: 'Abort'
    });
  });
  xhr.addEventListener('error', e => {
    reject({
      code: 0,
      message: (e && e.message) || 'xhr Error'
    });
  });
  xhr.addEventListener('timeout', () => {
    reject({
      code: 0,
      message: 'Timeout'
    });
  });
  xhr.send(config.body);
  return xhr;
}

export default (data, abort) => {
  return Task.of((resolve, reject) => {
    let xhr = startXhr(data, resolve, reject);
    if (abort) {
      abort({
        id: data.url,
        abortAble: xhr
      });
    }
  });
};

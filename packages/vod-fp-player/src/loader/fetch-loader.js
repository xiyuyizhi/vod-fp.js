import { Task, Fail, CusError, F } from 'vod-fp-utility';
import { LOADER_ERROR } from '../error';

const { curry } = F;

const FETCH_BODY = {
  text: 'text',
  arraybuffer: 'arrayBuffer',
  json: 'json',
  blob: 'blob'
};

export default function fetchLoader(config, controller, resolve, reject) {
  let { url, body, method, headers, options, params } = config;
  let timer;
  if (params.timeout) {
    timer = setTimeout(() => {
      console.warn('TIMEOUT');
      reject(CusError.of(LOADER_ERROR.LOAD_TIMEOUT));
      controller.abort();
    }, params.timeout);
  }

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
    .then(res => res[FETCH_BODY[params.responseType]]())
    .then(res => {
      clearTimeout(timer);
      resolve(res);
    })
    .catch(e => {
      clearTimeout(timer);
      if (e instanceof DOMException) {
        console.warn('ABORT');
        reject(CusError.of(LOADER_ERROR.ABORT));
        return;
      }
      reject(CusError.of(LOADER_ERROR.LOAD_ERROR));
    });
}

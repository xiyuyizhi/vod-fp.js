import { Task, Fail, CusError, F } from 'vod-fp-utility';
import { LOADER_ERROR } from '../error';
const { curry } = F;

export default function fetchStreamLoader(config) {
  const { url, method, headers, options } = config;
  if (!url) {
    throw new Error('url is required in fetchStreamLoader');
  }

  return fetch(url, {
    method,
    headers,
    body,
    ...options
  })
    .then(res => {
      if (res.ok && (res.status >= 200 && res.status < 300)) {
        return res;
      }
      return CusError.of({
        ...LOADER_ERROR.LOAD_ERROR,
        code: res.status,
        message: res.statusText
      });
    })
    .then(res => _readerStream(res.body.getReader()))
    .catch(e => {
      CusError.of(LOADER_ERROR.LOAD_ERROR);
    });
}

function _readerStream(reader) {
  let dump = () => {
    return reader.read().then(({ done, value }) => {
      if (done) {
        console.log('done');
        return;
      }
      console.log('receive data', value);
      return dump();
    });
  };
  return dump();
}
_readerStream = curry(_readerStream);

import { Task, Fail, CusError, F } from 'vod-fp-utility';
import { ACTION } from '../store';

const { curry } = F;

function _readStream({ dispatch }, reader) {
  return dump();

  function dump() {
    return reader.read().then(({ value, done }) => {
      if (done) {
        console.log('end of stream');
        return;
      }
      dispatch(ACTION.FLVLIVE.NEW_BUFFER_ARRIVE, value);
      return dump();
    });
  }
}

function fetchStreamLoader({ dispatch, connect }, url) {
  fetch(url)
    .then(res => connect(_readStream)(res.body.getReader()))
    .then(res => {
      console.log(res);
    })
    .catch(e => {
      console.log(e);
    });
}

_readStream = curry(_readStream);
fetchStreamLoader = curry(fetchStreamLoader);

export { fetchStreamLoader };

import { Task, Fail, CusError, F, Logger } from 'vod-fp-utility';
import { ACTION } from '../store';
import { SUPPORT_ERROR, FLV_LIVE_ERROR } from '../error';

const { curry } = F;
const logger = new Logger('player');

function _readStream({ dispatch }, reader) {
  return dump();

  function dump() {
    return reader.read().then(({ value, done }) => {
      if (done) {
        dispatch(ACTION.FLVLIVE.END_OF_STREAM);
        return;
      }
      dispatch(ACTION.FLVLIVE.WRITE_CHUNKS, value);
      return dump();
    });
  }
}

function fetchStreamLoader({ dispatch, connect }, url) {
  if (!window.fetch) {
    dispatch(ACTION.ERROR, CusError.of(SUPPORT_ERROR.NOT_SUPPORT_FETCH));
    return;
  }

  fetch(url)
    .then(res => connect(_readStream)(res.body.getReader()))
    .catch(e => {
      logger.error(e);
      dispatch(ACTION.ERROR, CusError.of(FLV_LIVE_ERROR.LOAD_ERROR));
    });
}

_readStream = curry(_readStream);
fetchStreamLoader = curry(fetchStreamLoader);

export { fetchStreamLoader };

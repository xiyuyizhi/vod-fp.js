import { Task, Fail, CusError, F, Logger } from 'vod-fp-utility';
import { ACTION } from '../store';
import { SUPPORT_ERROR, FLV_LIVE_ERROR } from '../error';

const { curry } = F;
const logger = new Logger('player');

function _readStream({ dispatch }, reader, headers) {
  let receivedLength = 0;
  let contentLength = headers.get('Content-Length') || 0;

  let ts = performance.now();

  return dump();

  function dump() {
    return reader.read().then(({ value, done }) => {
      if (done) {
        if (contentLength && contentLength !== receivedLength) {
          dispatch(ACTION.ERROR, FLV_LIVE_ERROR.EARLY_FINISH);
        }
        dispatch(ACTION.FLVLIVE.END_OF_STREAM);
        return;
      }
      receivedLength += value.byteLength;

      let tsTick = performance.now() - ts;

      if (tsTick > 1) {
        dispatch(
          ACTION.LOADINFO.COLLECT_DOWNLOAD_SPEED,
          value.byteLength / tsTick / 1000
        );
      }

      dispatch(ACTION.FLVLIVE.WRITE_CHUNKS, value);
      ts = performance.now();

      return dump();
    });
  }
}

function fetchStreamLoader({ dispatch, connect }, url) {
  if (!window.fetch || !window.AbortController) {
    dispatch(ACTION.ERROR, CusError.of(SUPPORT_ERROR.NOT_SUPPORT_FETCH));
    return;
  }
  let controller = new AbortController();
  fetch(url, {
    signal: controller.signal,
  })
    .then((res) => {
      if (res.ok && res.status >= 200 && res.status < 300) {
        dispatch(ACTION.FLVLIVE.ABORTABLE, controller);
        return res;
      }
      dispatch(
        CusError.of({
          ...FLV_LIVE_ERROR.LOAD_ERROR,
          code: res.status,
          message: res.statusText,
        })
      );
    })
    .then((res) => connect(_readStream)(res.body.getReader(), res.headers))
    .catch((e) => {
      dispatch(
        ACTION.ERROR,
        CusError.of({
          ...FLV_LIVE_ERROR.LOAD_ERROR,
          code: e.code,
          message: e.message || e,
        })
      );
    });
}

_readStream = curry(_readStream);
fetchStreamLoader = curry(fetchStreamLoader);

export { fetchStreamLoader };

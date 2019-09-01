import { F, CusError, Logger } from 'vod-fp-utility';
import { SUPPORT_ERROR, FLV_LIVE_ERROR } from '../error';
import { ACTION } from '../store';

const { curry } = F;
const logger = new Logger('player');

function websocketLoader({ dispatch }, url) {
  if (!window.WebSocket) {
    dispatch(ACTION.ERROR, CusError.of(SUPPORT_ERROR.NOT_SUPPORT_WEBSOCKET));
    return;
  }

  let socket = new WebSocket(url);
  let ts = 0;
  dispatch(ACTION.FLVLIVE.ABORTABLE, socket);

  socket.addEventListener('open', () => {
    logger.log('websocket open');
  });

  socket.addEventListener('close', () => {
    logger.log('websocket closed');
    dispatch(ACTION.FLVLIVE.END_OF_STREAM);
  });

  socket.addEventListener('error', e => {
    dispatch(ACTION.ERROR, CusError.of(FLV_LIVE_ERROR.LOAD_ERROR));
  });

  socket.addEventListener('message', e => {
    let reader = new FileReader();

    reader.onload = () => {
      let tsTick = performance.now() - ts;
      if (tsTick > 0.5) {
        dispatch(
          ACTION.LOADINFO.COLLECT_DOWNLOAD_SPEED,
          reader.result.byteLength / tsTick / 1000
        );
      }
      ts = performance.now();
      dispatch(ACTION.FLVLIVE.WRITE_CHUNKS, new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(e.data);
  });
}

websocketLoader = curry(websocketLoader);

export { websocketLoader };

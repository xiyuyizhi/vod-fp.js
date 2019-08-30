import { F, Logger } from 'vod-fp-utility';
import { fetchStreamLoader } from '../loader/fetch-stream-loader';
import { websocketLoader } from '../loader/websocket-loader';
import { ACTION, PROCESS } from '../store';
import { toMuxFlvChunks } from '../mux/mux';
import { Maybe } from 'vod-fp-utility/src';
import { endOfMediaSource } from '../media/media';

const { curry } = F;
const logger = new Logger('player');

function flvLiveBootstrap({ dispatch, getState, connect, subscribe }, url) {
  logger.log('flv live bootstrap');

  let mux = connect(toMuxFlvChunks);

  dispatch(ACTION.FLVLIVE.INIT);

  subscribe(ACTION.FLVLIVE.END_OF_STREAM, () => {
    logger.log('end of stream');
    connect(endOfMediaSource);
  });

  subscribe(ACTION.FLVLIVE.READ_CHUNKS, bufferInfo => {
    bufferInfo.map(c => {
      let { chunks, remain } = c;
      logger.groupEnd();
      logger.group('process new chunks');
      let temp = new Uint8Array(chunks.byteLength + remain.byteLength);
      temp.set(remain, 0);
      temp.set(chunks, remain.byteLength);
      mux(temp);
    });
  });

  let isSocketUrl = /wss?\:\/\//.test(url);
  if (isSocketUrl) {
    connect(websocketLoader)(url);
  } else {
    connect(fetchStreamLoader)(url);
  }
}

flvLiveBootstrap = curry(flvLiveBootstrap);

export { flvLiveBootstrap };

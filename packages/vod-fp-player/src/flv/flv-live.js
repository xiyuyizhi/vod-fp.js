import { F, Logger } from 'vod-fp-utility';
import { fetchStreamLoader } from '../loader/fetch-stream-loader';
import { ACTION, PROCESS } from '../store';
import { toMuxFlvChunks } from '../mux/mux';
import { Maybe } from 'vod-fp-utility/src';
const { curry } = F;
const logger = new Logger('player');

function flvLiveBootstrap({ dispatch, getState, connect, subscribe }, url) {
  logger.log('flv live bootstrap');

  let mux = connect(toMuxFlvChunks);
  dispatch(ACTION.FLVLIVE.INIT);

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

  connect(fetchStreamLoader)(url);
}

flvLiveBootstrap = curry(flvLiveBootstrap);

export { flvLiveBootstrap };

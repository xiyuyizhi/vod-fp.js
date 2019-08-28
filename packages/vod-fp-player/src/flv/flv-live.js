import { F, Logger } from 'vod-fp-utility';
import Mux from 'vod-fp-mux';
import { fetchStreamLoader } from '../loader/fetch-stream-loader';
import { ACTION, PROCESS } from '../store';

const { curry } = F;
const logger = new Logger('player');
const { FlvToMp4 } = Mux;

let BUFFER_WATER_MARK = 1024 * 350;

function flvLiveBootstrap({ dispatch, connect, subscribe }, url) {
  logger.log('flv live bootstrap');

  let offset = 0;
  let bufferPool = new Uint8Array(BUFFER_WATER_MARK);
  let flvToMp4 = new FlvToMp4();
  let restBuffer = new Uint8Array();

  flvToMp4.on('data', data => {
    logger.log(data);
    if (data.type === 'video') {
      dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, data);
      dispatch(ACTION.PROCESS, PROCESS.MUXED);
    }
    if (data.type === 'audio') {
      dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, data);
    }
  });

  flvToMp4.on('error', e => {
    console.log(e);
  });

  flvToMp4.on('restBufferInfo', info => {
    restBuffer = info.buffer;
    logger.log('chunks parsed,rest buffer info', info);
  });

  subscribe(ACTION.FLVLIVE.NEW_BUFFER_ARRIVE, buffer => {
    buffer = buffer.value();
    if (offset + buffer.byteLength > BUFFER_WATER_MARK) {
      let buffer = new Uint8Array(restBuffer.byteLength + offset);

      buffer.set(restBuffer, 0);
      buffer.set(bufferPool.subarray(0, offset), restBuffer.byteLength);

      restBuffer = new Uint8Array();
      bufferPool = new Uint8Array(BUFFER_WATER_MARK);
      offset = 0;

      logger.groupEnd();
      logger.group('process new chunks');
      flvToMp4.push(buffer);
      flvToMp4.flush();
    }
    bufferPool.set(buffer, offset);
    offset += buffer.byteLength;
  });
  connect(fetchStreamLoader)(url);
}

flvLiveBootstrap = curry(flvLiveBootstrap);

export { flvLiveBootstrap };

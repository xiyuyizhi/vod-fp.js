import {PipeLine, Logger} from 'vod-fp-utility';
import {tsProbe} from '../utils/probe';
import {ERROR, withMessage} from '../error';

let logger = new Logger('mux');

export default class TsPacketStream extends PipeLine {
  push(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }
    const syncOffset = tsProbe(buffer);
    logger.log('监测ts流第一个同步字节的位置: ', syncOffset);
    if (syncOffset === -1) {
      this.emit('error', withMessage(ERROR.NOT_VALID_FORMAT, 'not valid ts format'));
      return;
    }
    let len = buffer.byteLength;
    len -= (len - syncOffset) % 188;
    for (let i = syncOffset, j = 0; i < len;) {
      this.emit('data', buffer.subarray(i, i + 188));
      i += 188;
    }
  }
}

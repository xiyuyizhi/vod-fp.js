import { PipeLine } from 'vod-fp-utility';
import { probe } from '../probe/ts-probe';
import { NOT_VALID_TS_FORMAT } from '../error';
import Logger from '../utils/logger';

let logger = new Logger('TsPacketStream');

export default class TsPacketStream extends PipeLine {
  push(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }
    const syncOffset = probe(buffer);
    logger.log('监测ts流第一个同步字节的位置: ', syncOffset);

    if (syncOffset === -1) {
      this.emit('error', NOT_VALID_TS_FORMAT);
      return;
    }
    let len = buffer.byteLength;
    len -= (len - syncOffset) % 188;
    for (let i = syncOffset, j = 0; i < len; ) {
      this.emit('data', buffer.subarray(i, i + 188));
      i += 188;
    }
  }
}

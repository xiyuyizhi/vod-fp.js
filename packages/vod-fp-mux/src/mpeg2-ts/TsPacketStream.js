import { PipeLine } from 'vod-fp-utility';
import { probe } from '../probe/ts-probe';
import { logger } from '../utils/logger';

export default class TsPacketStream extends PipeLine {
  push(buffer, sequenceNumber = 0) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }
    // reset(sequenceNumber);
    const syncOffset = probe(buffer);
    logger.log('监测ts流第一个同步字节的位置: ', syncOffset);
    let len = buffer.byteLength;
    len -= (len - syncOffset) % 188;
    for (let i = syncOffset, j = 0; i < len; ) {
      this.emit('data', buffer.subarray(i, i + 188));
      i += 188;
    }
  }
}

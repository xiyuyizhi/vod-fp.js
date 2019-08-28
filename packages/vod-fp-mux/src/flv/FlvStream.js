import { PipeLine, Logger } from 'vod-fp-utility';
import { ERROR, withMessage } from '../error';
import { flvProbe } from '../utils/probe';

let logger = new Logger('mux');

export default class FlvStream extends PipeLine {
  constructor() {
    super();
    this.hasPraseFlvHeader = false;
    this.metadata = null;
  }

  push(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }
    if (!this.hasPraseFlvHeader && !flvProbe(buffer)) {
      this.emit(
        'error',
        withMessage(ERROR.NOT_VALID_FORMAT, 'not valid flv format')
      );
      return;
    }
    if (!this.hasPraseFlvHeader) {
      let metadata = this._parseFlvHead(buffer);
      this.metadata = metadata;
      logger.log(metadata);
      this.emit('data', {
        type: 'metadata',
        data: metadata
      });
      this.emit('data', buffer.subarray(9 + 4));
      this.hasPraseFlvHeader = true;
      return;
    }

    this.emit('data', {
      type: 'metadata',
      data: this.metadata
    });
    this.emit('data', buffer);
  }

  _parseFlvHead(buffer) {
    /**
     * head  9 字节
     *
     * Byte 1-3 FLV
     * Byte 4   version
     * Byte 5
     *       bit 1-5  TypeFlagsReserved (shall be 0)
     *       bit 6    TypeFlagsAudio  1 = audio persent // & 0x04
     *       bit 7    shall be 0
     *       bit 8    TypeFlagsVideo  1 = video persent //  & 0x01
     * Byte 6 - 9     DataOffset   the length of this header in bytes
     *
     */
    let hasAudio = (buffer[4] & 0x04) >> 2;
    let hasVideo = buffer[4] & 0x01;
    return {
      audio: hasAudio === 1 ? 1 : -1,
      video: hasVideo === 1 ? 1 : -1
    };
  }
}

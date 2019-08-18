import {PipeLine, Logger} from 'vod-fp-utility';
import {NOT_VALID_FLV_FORMAT} from '../error';
import {flvProbe} from "../utils/probe"

let logger = new Logger('mux');

export default class FlvStream extends PipeLine {

  push(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }
    if (!flvProbe(buffer)) {
      this.emit('error', NOT_VALID_TS_FORMAT);
      return;
    }
    let metadata = this._parseFlvHead(buffer);
    this.emit('data', {
      metadata,
      buffer: buffer.subarray(9)
    })
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

    return {
      version: buffer[3],
      audio: (buffer[4] & 0x04) >> 2,
      video: (buffer[4] & 0x01)
    }
  }

}

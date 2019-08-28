import { PipeLine, Logger } from 'vod-fp-utility';
import { ERROR, withMessage } from '../error';

let logger = new Logger('mux');
export default class FlvTagStream extends PipeLine {
  push(buffer) {
    if (buffer.type) return;

    let offset = 0;
    let bfLen = buffer.byteLength;
    while (offset + 11 < bfLen) {
      let tagInfo = this._parseFlvTag(buffer, offset);

      if (tagInfo.encrypted) {
        this.emit(
          'error',
          withMessage(ERROR.PARSE_ERROR),
          'encrypted flv,not support yet'
        );
        break;
      }

      let tagLength = tagInfo.tagLength;

      if (offset + tagLength > bfLen) {
        logger.warn(
          `this last tag is cuted,not complete, offset=${offset} , tagLength = ${tagLength},bfLength = ${bfLen}`
        );
        break;
      }

      this.emit('data', tagInfo);
      offset += tagLength; // 11为 FlvTag 的header
      offset += 4; // the current tag size
    }

    this.emit('restBufferInfo', {
      bufferLength: bfLen,
      offset,
      buffer: buffer.subarray(offset)
    });
  }

  _parseFlvTag(buffer, offset) {
    /**
     * header 11字节
     * Byte 1
     *       bit 1-2    reserved shoud be 0
     *       bit 3      indicate if the packet are filtered. 0 for unencrypted , 1 for encrypted
     *       bit 4-8    TagType:  8 = audio, 9 = video, 18 = script data
     * Byte  2-4   DataSize : number of bytes after StreamId to end to tag,equal tag.length - 11
     * Byte  5-7   TimeStamp : time in ms at which the data in the tag applies.
     *                         the value is relative to the first tag in the flv file.
     * Byte 8      TimeStampExtended :
     * Byte 9-11   StreamID : always 0
     *
     */

    let encrypted = (buffer[offset] & 0x20) >> 5;
    let tagType = buffer[offset] & 0x1f;
    offset += 1;
    let dataSize =
      (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
    offset += 3;
    let timestamp =
      (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
    offset += 3;
    let timestampExtended = buffer[offset];
    let ts = (timestampExtended << 8) | timestamp; // ms

    offset += 1;
    offset += 3; // skip streamID
    return {
      encrypted,
      tagType,
      dataSize,
      tagLength: dataSize + 11,
      ts: ts * 90,
      payload: buffer.subarray(offset, offset + dataSize)
    };
  }
}

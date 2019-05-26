import {PipeLine} from 'vod-fp-utility';
import Logger from '../utils/logger';

let logger = new Logger('TsElementaryStream')

export default class TsElementaryStream extends PipeLine {
  constructor() {
    super();
    this.cache = {
      video: null,
      audio: null
    };
  }

  push(pesInfo) {
    const {type, starter, data} = pesInfo;
    if (type === 'metadata') {
      this.emit('data', pesInfo);
      return;
    }
    if (starter) {
      if (this.cache[type]) {
        const pes = this.parsePES(this.cache[type], 0);
        this.emit('data', {type, pes});
      }
      this.cache[type] = {
        data: [],
        size: 0
      };
    }
    if (this.cache[type]) {
      this
        .cache[type]
        .data
        .push(data);
      this.cache[type].size += data.byteLength;
    }
  }

  flush() {
    // 还剩最后一个pes没解析
    if (this.cache.video && this.cache.video.data.length) {
      const pes = this.parsePES(this.cache.video, 0);
      this.emit('data', {
        type: 'video',
        pes
      });
    }
    if (this.cache.audio && this.cache.audio.data.length) {
      const pes = this.parsePES(this.cache.audio, 0);
      this.emit('data', {
        type: 'audio',
        pes
      });
    }
    this.cache = {
      video: null,
      audio: null
    };
    this.emit('done');
  }

  parsePES(stream, offset) {
    /**
     * http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
     * ISO-13818-1 Table-2-17
     * packet_start_code_prefix : 24bit 0x000001
     * stream_id : 8bit
     * PES_packet_length : 16bit
     * PTS_DTS_flags : 2bit 【PES_packet_length后第2字节前2位】& 0xc0  [0x10 0x11]
     * PES_header_data_length : 【PTS_DTS_flags 后1字节】
     */
    let pesLen = 0;
    let pts;
    let dts;
    const firstPayload = stream.data[0];
    // logger.log(offset, firstPayload);
    const pscp = (firstPayload[offset] << 16) | (firstPayload[offset + 1] << 8) | firstPayload[offset + 2];
    if (pscp === 0x000001) {
      // logger.warn('parse PES');
      offset += 3;
      pesLen = (firstPayload[offset + 1] << 8) | firstPayload[offset + 2];
      offset += 4;
      const pdtsFlag = (firstPayload[offset] & 0xc0) >> 6;
      offset += 1;
      const pesHdrLen = firstPayload[offset];
      offset += 1;
      if (pdtsFlag) {
        ({pts, dts} = this.parsePESHeader(firstPayload, offset, pdtsFlag));
      }
      // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
      let payloadStartOffset = pesHdrLen + 6 + 3;
      stream.size -= payloadStartOffset;
      // reassemble PES packet
      let pesData = new Uint8Array(stream.size);
      let i = 0;
      for (let j = 0, dataLen = stream.data.length; j < dataLen; j++) {
        let frag = stream.data[j];
        let len = frag.byteLength;
        if (payloadStartOffset) {
          if (payloadStartOffset > len) {
            // trim full frag if PES header bigger than frag
            payloadStartOffset -= len;
            continue;
          } else {
            // trim partial frag if PES header smaller than frag
            frag = frag.subarray(payloadStartOffset);
            len -= payloadStartOffset;
            payloadStartOffset = 0;
          }
        }
        pesData.set(frag, i);
        i += len;
      }
      if (pesLen) {
        // payload size : remove PES header + PES extension
        pesLen = pesLen - pesHdrLen - 3;
      }
      return {data: pesData, pts, dts, len: pesLen, tsPacket: stream.data};
    }
    logger.error(`parse pes error,pscp = ${pscp}`);
    logger.log(stream.data, stream.size, offset);

    return null;
  }

  parsePESHeader(payload, offset, pdtsFlag) {
    let pts;
    let dts;
    pts = (payload[offset] & 0x0e) * 536870912 + // 1 << 29
    (payload[offset + 1] & 0xff) * 4194304 + // 1 << 22
    (payload[offset + 2] & 0xfe) * 16384 + // 1 << 14
    (payload[offset + 3] & 0xff) * 128 + // 1 << 7
    (payload[offset + 4] & 0xfe) / 2;
    if (pts > 4294967295) {
      // decrement 2^33
      pts -= 8589934592;
    }
    offset += 5;
    if (pdtsFlag === 3) {
      // have dts
      dts = (payload[offset] & 0x0e) * 536870912 + // 1 << 29
      (payload[offset + 1] & 0xff) * 4194304 + // 1 << 22
      (payload[offset + 2] & 0xfe) * 16384 + // 1 << 14
      (payload[offset + 3] & 0xff) * 128 + // 1 << 7
      (payload[offset + 4] & 0xfe) / 2;
      // check if greater than 2^32 -1
      if (dts > 4294967295) {
        // decrement 2^33
        dts -= 8589934592;
      }
      if (pts - dts > 60 * 90000) {
        logger.warn(`${Math.round((pts - dts) / 90000)}s delta between PTS and DTS, align them`);
        pts = dts;
      }
    } else {
      dts = pts;
    }
    return {pts, dts};
  }
}

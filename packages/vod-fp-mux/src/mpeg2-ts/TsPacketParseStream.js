import { PipeLine, Logger } from 'vod-fp-utility';
import { NOT_FOUNT_PMT, LACK_VIDEO_OR_AUDIO_DATA } from '../error';
import { checkCombine } from "../utils/index"
let logger = new Logger('mux');

export default class TsPacketParseStream extends PipeLine {
  constructor() {
    super();
    this.pmtId = -1;
    this.streamInfo = null;
    this.hasAudioData = false;
    this.hasVideoData = false;
  }
  push(packet) {
    let adaptionsOffset = 0;
    let header = this.parseTsHeader(packet.subarray(0, 4));
    let payload = packet.subarray(4);
    if (
      header &&
      (header.adaptationFiledControl === 3 ||
        header.adaptationFiledControl === 2)
    ) {
      adaptionsOffset = this.parseAdaptationFiled(payload) + 1;
    }
    this.parsePayload(payload, adaptionsOffset, header);
  }

  parseTsHeader(data) {
    /** https://en.wikipedia.org/wiki/MPEG_transport_stream
     * 第一字节 0x47
     * 第二字节:
     *    bit1 :Transport Error Indicator (TEI) & 0x80
     *    bit2 : Payload Unit Start Indicator   & 0x40
     *    bit3 : Transport               & 0x20
     * rest+第三字节:  pid    & 0x1f << 8 + 第三字节
     * 第四字节:
     *    bit1-2 : Transport Scrambling Control  & 0xc0
     *    bit2-4 : Adaptation field control      & 0x30 【00 01 no  adaptation】
     *    bit4-8 : Continuity counter            & 0x0f
     * */
    if (data[0] === 0x47) {
      const result = {};
      result.tsErrorIndicator = data[1] & 0x80;
      result.payloadStartIndicator = (data[1] & 0x40) >> 6;
      result.pid = ((data[1] & 0x1f) << 8) + data[2];
      result.tsc = (data[3] & 0xc0) >> 6;
      result.adaptationFiledControl = (data[3] & 0x30) >> 4;
      result.cc = data[3] & 0x0f;
      return result;
    }
    return null;
  }

  parseAdaptationFiled(payload) {
    /**
     *  header 中 Adaptation field control
     *    10 : adaptation field only, no payload
     *    11 : adaptation field followed by payload
     *  第一字节 : Adaptation Field Length
     */
    const adaptationLength = payload[0];
    return Math.min(adaptationLength, 188 - 5);
  }

  _equalPmtId(pid, pmtId) {
    if (pid === pmtId) return true;
    if (pid % 256 && pid % 256 === pmtId % 256) return true;
  }

  parsePayload(payload, offset, header = {}) {
    /**
     * https://en.wikipedia.org/wiki/Program-specific_information
     *
     * |---Adaptation Filed(option)---|--payload--|
     * PSI:[PAT PMT CAT]
     *    第一字节 : pointer field  0 or not
     *    N * 0xFF : Pointer filler bytes 【pointer field 为 0 时不存在】
     * payload 针对PAT:
     * ISO-13818-1 Table-2-25
     *    table id : 1字节 【0x00: PAT、0x01: CAT、0x02: PMT、0x40: NIT】section
     *    Section syntax indicator : 1bit
     *    0 : 1bit
     *    Reserved bits : 2bit  11
     *    Section length : 12bit
     *    .
     *    .
     *    .共10 bytes
     */
    if (header.pid == 0) {
      // logger.warn('parse PAT');
      offset += 1 + payload[offset]; // table start position
      this.pmtId = this.parsePAT(payload, offset);
      return;
    }
    if (this._equalPmtId(header.pid, this.pmtId)) {
      offset += 1 + payload[offset]; // table start position
      this.streamInfo = this.parsePMT(payload, offset);
      // logger.warn('parse PMT', this.streamInfo);
      this.emit('data', {
        type: 'metadata',
        data: this.streamInfo
      });
      return;
    }
    if (!this.streamInfo) {
      return;
    }
    const { videoId, audioId } = this.streamInfo;
    switch (header.pid) {
      case videoId:
        this.hasVideoData = true;
        this.emit('data', {
          type: 'video',
          starter: header.payloadStartIndicator,
          data: payload.subarray(offset)
        });
        break;
      case audioId:
        this.hasAudioData = true;
        this.emit('data', {
          type: 'audio',
          starter: header.payloadStartIndicator,
          data: payload.subarray(offset)
        });
        break;
      default:
      // logger.warn('unknow pid ', header.pid);
    }
  }

  parsePAT(payload, offset) {
    const pNum = (payload[offset + 8] << 8) | payload[offset + 9];
    let pmtId = ((payload[offset + 10] & 0x1f) << 8) | payload[offset + 11];
    // logger.log('program number: ' + pNum, ',pmtId: ' + pmtId);
    return pmtId;
  }

  parsePMT(payload, offset) {
    /**
     * ISO-13818-1 Table-2-25
     * payload 针对 PMT:
     *  section_length : 12bit 【table 第2字节后四位，3字节】
     *  program_number : 16bit 【table第4，5字节】
     *  program_info_length : 12bit 【table 第11字节后 4bit + 第12 byte】
     *  N * 8 : descriptor
     *  stream_type : 8bit
     *  reserved : 3bit
     *  elementary_PID : 13bit
     *  reserved : 4bit
     *  ES_info_length: 12bit
     */
    const sectionLen =
      ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];
    const tableEnd = offset + 3 + sectionLen - 4;
    const pNum = (payload[offset + 3] << 8) | payload[offset + 4];
    const pil =
      ((payload[offset + 10] & 0x0f) << 8) | payload[offset + 11] || 0;
    offset = offset + 11 + pil + 1; // stream_type position
    const result = {
      videoId: -1,
      audioId: -1
    };
    let stremType;
    while (offset < tableEnd) {
      stremType = payload[offset];
      offset += 1; // ele_Pid position
      const ePid = ((payload[offset] & 0x1f) << 8) | payload[offset + 1];
      offset += 2; // es_info_l position
      const esil = ((payload[offset] & 0x0f) << 8) | payload[offset + 1];
      offset += 2;
      switch (stremType) {
        case 0x1b:
          result.videoId = ePid;
          break;
        case 0x0f:
          result.audioId = ePid;
          break;
        case 0x03:
        case 0x04:
          logger.warn('mp3 audio found,not support yet');
          break;
        default:
      }
    }
    return result;
  }

  flush() {
    if (!this.streamInfo) {
      this.emit('error', NOT_FOUNT_PMT);
    }
    if (checkCombine(this.streamInfo) && (!this.hasVideoData || !this.hasAudioData)) {
      this.emit('error', LACK_VIDEO_OR_AUDIO_DATA);
    }
    this.emit('done');
  }
}

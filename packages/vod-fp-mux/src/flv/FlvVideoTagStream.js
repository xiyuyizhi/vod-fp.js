import {PipeLine, Logger} from 'vod-fp-utility';
import {geneVideoCodecStr} from "../utils/index"
import ExpGolomb from '../utils/exp-golomb';

let logger = new Logger('mux');

export default class FlvVideoTagStream extends PipeLine {

  constructor() {
    super();
    this.videoTrack = null;
  }

  push(data) {
    if (data.tagType === 9) {
      let {encrypted, payload, ts} = data
      this._parseFlvPaylod(payload, encrypted, ts)
    }
  }

  flush() {
    logger.log('videoTrack', this.videoTrack);
    this.emit('data', this.videoTrack);
    this.videoTrack = null;
    this.emit('done')
  }

  _parseFlvPaylod(buffer, encrypted, ts) {

    // parse header,encryption,filterPrams first
    let videoHeaderInfo = this._parseVideoTagHeader(buffer);
    if (encrypted) {
      this._parseEncryptionHeader();
      this._parseFilterParams();
    }
    this._parseVideoData(buffer.subarray(videoHeaderInfo.headerLength), videoHeaderInfo, ts);

  }

  _parseVideoTagHeader(buffer) {
    /**
     * frameType  Ubit[4]  1: keyframe 2: inter frame
       codecId    Ubit[4]  7: avc
       if codecId ===7
         avcPacketType  Ubit[8]  0:avc sequence header 1:avc nalu 2:avc end of sequence
        compositionTime 3字节   if avcPakcetType =1,composition offset time else 0
     */

    let frameType = (buffer[0] & 0xf0) >> 4;
    let codecId = (buffer[0] & 0x0f);
    let avcPacketType;
    let compositionTime = 0;
    if (codecId) {
      avcPacketType = buffer[1]
      compositionTime = (buffer[2] << 16) | (buffer[3] << 8) | (buffer[4])
    }
    if (frameType === 1) {
      logger.warn('detect key frame');
    }
    if (codecId === 7 && avcPacketType === 2) {
      logger.warn('avc end of sequeue');
    }
    return {
      frameType,
      codecId,
      avcPacketType,
      compositionTime,
      headerLength: codecId === 7
        ? 5
        : 4
    }
  }

  _parseVideoData(buffer, metadata, ts) {
    /**
     * avcpacketType = 0 : AvcDecodeerConfigurationRecord
     * avcpacketType = 1 : one or more nalu
     * avcpacketType = 2 : Empty
     */
    let {frameType, codecId, avcPacketType, compositionTime} = metadata;
    if (!buffer.byteLength) 
      return;
    if (frameType !== 5 && codecId === 7) {
      //avc video packet
      if (avcPacketType === 0) {
        // AVCDecoderConfigurationRecord
        logger.warn('AVCDecoderConfigurationRecord');
        let avcConfig = this._parseAvcDecodeerConfigurationRecord(buffer)
        this.videoTrack = this._geneVideoTrack(avcConfig)
      }
      if (avcPacketType === 1) {
        let {units, keyframe} = this._parseAvcNalUnits(buffer, this.videoTrack.nalUnitSizeLength)
        this
          .videoTrack
          .samples
          .push({
            dts: ts,
            key: frameType === 1 || keyframe,
            compositionTime: compositionTime * 90,
            pts: ts + compositionTime * 90,
            units
          })
        this.videoTrack.len += buffer.byteLength;
      }
    }
  }

  _parseAvcNalUnits(buffer, nalUnitSizeLength) {

    let units = [],
      length = 0;
    let offset = 0;
    let lengthSize = nalUnitSizeLength;
    let dataSize = buffer.byteLength;
    let keyframe = false;
    while (offset < dataSize) {
      if (offset + 4 >= dataSize) {
        break;
      }
      let naluSize = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3]; // the nal length
      if (lengthSize === 3) {
        naluSize >>>= 8;
      }
      if (naluSize > dataSize - lengthSize) {
        logger.warn('invalid naluSize')
        return;
      }
      offset += lengthSize;
      let unitType = buffer[offset] & 0x1f;
      if (unitType === 5) { // IDR
        keyframe = true;
      }
      let data = buffer.subarray(offset, offset + naluSize);
      let unit = {
        type: unitType,
        data: data
      };
      units.push(unit);
      offset += naluSize;
    }
    return {units, keyframe}
  }

  _parseAvcDecodeerConfigurationRecord(buffer) {
    /**
     *  configurationVerison = 1  uint(8)
     *  avcProfileIndication      uint(8)
     *  profile_compatibility     uint(8)
     *  avcLevelIndication        uint(8)
     *  reserved   `111111`       bit(6)
     *  lengthSizeMinusOne        uint(2)
     *  reserved   `111`          bit(3)
     *  numOfSPS                  uint(5)
     *  for(numOfSPS)
     *    spsLength               uint(16)
     *    spsNALUnit              spsLength个字节
     *  numOfPPS                  uint(8)
     *  for(numOfPPS)
     *     ppsLength              uint(16)
     *     ppsNALUnit             ppsLength个字节
     */

    let offset = 1;
    let profileIdc = buffer[offset];
    let profileComp = buffer[offset + 1];
    let levelIdc = buffer[offset + 2];
    let nalUnitSizeLength;
    offset += 2;
    offset += 1;
    nalUnitSizeLength = buffer[offset] & 3 + 1;
    offset += 1;
    let numOfSPS = buffer[offset] & 0x1f;
    let sps = [];
    let pps = [];
    offset += 1;
    for (let i = 0; i < numOfSPS; i++) {
      let spsLength = (buffer[offset] << 8) | buffer[offset + 1];
      offset += 2;
      sps.push(buffer.subarray(offset, offset + spsLength))
      offset += spsLength;
    }
    let numOfPPS = buffer[offset];
    offset += 1;
    for (let j = 0; j < numOfPPS; j++) {
      let ppsLength = (buffer[offset] << 8) | buffer[offset + 1];
      offset += 2;
      pps.push(buffer.subarray(offset, offset + ppsLength))
      offset += ppsLength;
    }
    return {profileIdc, levelIdc, sps, pps, nalUnitSizeLength}
  }

  _parseEncryptionHeader() {}

  _parseFilterParams() {}

  _geneVideoTrack(avcConfig) {
    let {profileIdc, levelIdc, sps, pps, nalUnitSizeLength} = avcConfig;
    let expGolombDecoder = new ExpGolomb(sps[0]);
    let config = expGolombDecoder.readSPS();
    return {
      nalUnitSizeLength,
      samples: [],
      inputTimeScale: 90000,
      timescale: 90000,
      type: 'video',
      len: 0,
      sps,
      pps,
      profileIdc,
      levelIdc,
      width: config.width,
      height: config.height,
      pixelRatio: config.pixelRatio,
      codec: geneVideoCodecStr(sps[0].subarray(1, 4))
    }
  }

}

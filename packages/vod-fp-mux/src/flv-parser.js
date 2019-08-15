
import ExpGolomb from '../src/utils/exp-golomb';
const SOUND_FORMAT = [

]

function parseFlv(buffer) {
  console.log(buffer);
  console.log('is flv?', _flvProbe(buffer))
  console.log('header', _parseFlvHead(buffer));
  _parseFlvBody(buffer);
}


function _flvProbe(buffer) {
  return [buffer[0], buffer[1], buffer[2]].map(x => String.fromCharCode(x)).join('') === 'FLV'
}

function _parseFlvHead(buffer) {
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
    video: (buffer[4] & 0x01),
  }
}

function _parseFlvBody(buffer) {
  let offset = 9;
  offset += 4; // previous tag size, 4 byte
  // let length = buffer.byteLength;
  let length = 25000;
  while (offset < length) {
    console.group('a new flvTag')
    let tagLength = _parseFlvTag(buffer, offset);
    offset += tagLength;
    let prevTagSize = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | (buffer[offset + 3])
    console.groupEnd();
    offset += 4; // the current tag size
    // console.log('prev tag size', prevTagSize, tagLength, offset, length);
  }

}

function _parseFlvTag(buffer, offset) {
  /**
  *
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
  let dataSize = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  offset += 3;
  let timestamp = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  offset += 3;
  let timestampExtended = buffer[offset];
  let ts = timestampExtended << 8 | timestamp // ms

  offset += 1;
  offset += 3; // skip streamID
  let metadata = {
    encrypted,
    tagType,
    dataSize,
    ts
  }
  _parseFlvPaylod(buffer.subarray(offset, offset + dataSize), metadata)
  return dataSize + 11;
}

function _parseFlvPaylod(buffer, tagMetadata) {
  let { tagType, encrypted, dataSize } = tagMetadata;
  // parse header,encryption,filterPrams first
  let audioInfo;
  let videoInfo;
  if (tagType === 8) {
    audioInfo = _parseAudioTagHeader(buffer)
    tagMetadata = {
      ...tagMetadata,
      ...audioInfo
    }
  }
  if (tagType === 9) {
    videoInfo = _parseVideoTagHeader(buffer);
    tagMetadata = {
      ...tagMetadata,
      ...videoInfo
    }
  }
  console.log(tagMetadata)

  if (encrypted) {
    _parseEncryptionHeader();
    _parseFilterParams();
  }
  if (tagType === 8) {
    _parseAudioData(buffer.subarray(2), tagMetadata)
  }
  if (tagType === 9) {
    _parseVideoData(buffer.subarray(tagMetadata.headerLength), tagMetadata);
  }
  if (tagType === 18) {
    _parseScriptData()
  }
}


function _parseAudioTagHeader(buffer) {
  /**
   * 2 字节
   * soundFormat  bit 1-4  [eg: 1:adpcm  2:mp3 10:aac]
   * soundRate    bit 5-6  [ 0: 5.5Khz  1: 11Khz 2: 22Khz  3: 44Khz]
   * soundSize    bit 7    0: 8 bit samples 1: 16 bit samples
   * soundType    bit 8    0: mono sound(单声道)  1: stereo sound(立体声)
   * aacPacketType 1字节    0 = aac sequence header ,1 = aac raw
   */
  let soundFormat = (buffer[0] & 0xf0) >> 4;
  let soundRate = (buffer[0] & 0x0c) >> 2;
  let soundSize = (buffer[0] & 0x02) >> 1;
  let soundType = buffer[0] & 0x01;
  let aacPacketType = buffer[1];
  return {
    soundFormat, soundRate, soundSize, soundType, aacPacketType
  }
}

function _parseVideoTagHeader(buffer) {
  let frameType = (buffer[0] & 0xf0) >> 4;
  let codecId = (buffer[0] & 0x0f);
  let avcPacketType;
  let compositionTime = 0;
  if (codecId) {
    avcPacketType = buffer[1]
    compositionTime = (buffer[2] << 16) | (buffer[3] << 8) | (buffer[4])
  }
  if (frameType === 1) {
    console.warn('detect key frame');
  }
  if (codecId === 7 && avcPacketType === 2) {
    console.warn('avc end of sequeue');
  }
  return {
    frameType,
    codecId,
    avcPacketType,
    compositionTime,
    headerLength: codecId === 7 ? 5 : 4,
  }
}

function _parseEncryptionHeader() {

}

function _parseFilterParams() { }


function _parseAudioData(buffer, metadata) {
  let { encrypted, soundFormat, aacPacketType } = metadata;
  if (!buffer.byteLength) return;
  if (encrypted) {
    // the audio data body is EncryptedBody
  } else {
    if (soundFormat === 10) {
      // aac
      if (aacPacketType === 0) {
        //AudioSpecificConfig
        console.warn('AudioSpecificConfig')
        let audioConfig = _parseAudioSpecificConfig(buffer);
        console.log(audioConfig);
      } else {
        // raw aac frame data in UI8 []
        // console.log(buffer)
      }
    } else {

    }
  }
}

function _parseAudioSpecificConfig(buffer) {
  /**
  *  audioObjectType    5bit
  *  samplingFrquecyIndex   4bit
  *  if(samplingFrquencyIndex === 0xf)
  *     samplingFrequency   24bit 
  *  channelConfiguration   4bit |01111000|
  */
  let audioObjectType = (buffer[0] & 0xf8) >> 3;
  let samplingFrquecyIndex = ((buffer[0] & 0x07) << 1) | ((buffer[1] & 0x80) >> 7)
  let samplingFrequency;
  let channelConfiguration;
  if (samplingFrquecyIndex === 0xf) {
    if (buffer.byteLength < 5) {
      throw new Error('contain samplingFrequency, at least 5 byte need')
    }
    samplingFrequency = ((buffer[1] & 0x7f) << 17) |
      (buffer[2] << 9) |
      (buffer[3] << 1) |
      ((buffer[4] & 0x80) >> 7);
    channelConfiguration = (buffer[4] & 0x78) >> 3;
  }
  channelConfiguration = (buffer[1] & 0x78) >> 3;
  return {
    audioObjectType,
    samplingFrquecyIndex,
    samplingFrequency,
    channelConfiguration
  }
}


function _parseVideoData(buffer, metadata) {
  let { frameType, codecId, avcPacketType } = metadata;
  if (!buffer.byteLength) return;
  if (frameType !== 5 && codecId === 7) {
    //avc video packet
    if (avcPacketType === 0) {
      // AVCDecoderConfigurationRecord
      console.warn('AVCDecoderConfigurationRecord');
      let avcConfig = _parseAvcDecodeerConfigurationRecord(buffer)
      console.log(avcConfig)
    } else {
      // nalUs
      console.log(buffer)
    }
  }
}

function _parseAvcDecodeerConfigurationRecord(buffer) {
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
  offset += 2;
  offset += 2;
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
  return {
    profileIdc,
    levelIdc,
    sps,
    pps
  }
}

function _parseScriptData() {

}

export default parseFlv;

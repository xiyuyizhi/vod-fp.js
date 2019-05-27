import { PipeLine } from 'vod-fp-utility';
import { FREQUENCIES_MAP, getDefaultAACTrack } from '../default';
import Logger from "../utils/logger";

let logger = new Logger('AacStream')

export default class AacStream extends PipeLine {
  constructor() {
    super();
    this.aacTrack = null;
  }

  geneTrack(type) {
    if (this.aacTrack === null) {
      this.aacTrack = getDefaultAACTrack();
    }
  }

  push(data) {
    if (data.type === 'audio') {
      this.geneTrack('audio');
      this.parseADTS(data.pes.data, data.pes.dts);
      data.pes.data = null;
    }
  }

  flush() {
    this.emit('data', this.aacTrack);
    logger.log('aacTrack', this.aacTrack)
    this.emit('done');
    this.aacTrack = null;
  }

  parseADTS(payload, startDts) {
    /**
     * https://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
     * https://wiki.multimedia.cx/index.php/ADTS
     * ADTS Header
     * syncword   12 bit, all is 1
     * ID         1bit 【0 for MPEG-4, 1 for MPEG-2】
     * layer      2 bit '00'
     * protection_absent  1bit 【set to 1 if there is no CRC and 0 if there is CRC】
     * profile    2 bit   【0:null,1:Main profile、2:LC、3:SSR 4:LTP、5:SBR、...】【第二字节前两位】
     * sampling_frequency_index  4 bit
     * private_bit  1 bit
     * channel_configuration  3 bit 【第三字节最后一位 + 第四字节前2位】
     * originality  1 bit
     * home         1 bit
     * copyrighted id bit   1 bit
     * copyright id start   1 bit
     * frame length         13 bit【第四字节后2bit + 第五字节 + 第六字节前3bit】
     * FrameLength = (ProtectionAbsent == 1 ? 7 : 9) + size(AACFrame)
     * Buffer fullness      11 bit 【第六字节后5位 + 第七字节前6位】
     * Number of AAC frames  2 bit  【第七字节后2位】
     * CRC if protection absent is 0   16 bit 【8、9字节】
     */

    let offset = 0;
    let frameIndex = 0;
    let aacTrack = this.aacTrack;
    while (offset < payload.byteLength) {
      let start = offset;
      if (!offset[start] === 255 && (offset[start + 1] & 0xf0) === 0xf0) {
        logger.warn('aac PES payload not start with adts header');
        offset += 1;
        continue;
      }
      start += 1;
      const id = (payload[start] & 0x08) >> 3;
      const headerSize = (payload[start] & 0x01) === 1
        ? 7
        : 9;
      start += 1;
      if (!aacTrack.samplerate) {
        aacTrack.versionId = id;
        aacTrack.adtsObjectType = ((payload[start] & 0xc0) >> 6) + 1;
        aacTrack.samplerateIndex = (payload[start] & 0x3c) >> 2;
        aacTrack.samplerate = FREQUENCIES_MAP[aacTrack.samplerateIndex];
        aacTrack.timescale = aacTrack.samplerate;
        aacTrack.channel = ((payload[start] & 0x01) << 2) | ((payload[start + 1] & 0xc0) >> 6);
        aacTrack.frameDuration = this.getFrameDuration(aacTrack.samplerate);
        this.getAudioConfig(aacTrack);
      }
      start += 1;
      const frameLength = ((payload[start] & 0x03) << 11) | (payload[start + 1] << 3) | ((payload[start + 2] & 0xe0) >> 5);
      aacTrack
        .samples
        .push({
          data: payload.subarray(offset + headerSize, offset + frameLength),
          pts: startDts + aacTrack.frameDuration * frameIndex,
          dts: startDts + aacTrack.frameDuration * frameIndex
        });
      aacTrack.len += frameLength;
      offset += frameLength;
      frameIndex++;
    }
  }

  getAudioConfig(aacTrack) {
    let audioCodec = aacTrack.audioCodec;
    let config = new Array(2);
    let adtsObjectType = 2;
    let samplerateIndex = aacTrack.samplerateIndex;
    let adtsExtensionSampleingIndex = aacTrack.samplerateIndex;
    if (samplerateIndex >= 6) {
      adtsObjectType = 5;
      adtsExtensionSampleingIndex -= 3;
      config = new Array(4);
    }
    // if (!audioCodec && adtsExtensionSampleingIndex >= 6) {
    //   adtsExtensionSampleingIndex -= 3;
    // } else {
    //   if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && ((samplerateIndex >= 6 && aacTrack.channel === 1) || (!audioCodec && aacTrack.channel === 1))) {
    //     adtsObjectType = 2;
    //     config = new Array(2);
    //   }
    //   adtsExtensionSampleingIndex = samplerateIndex;
    // }
    config[0] = adtsObjectType << 3;
    config[0] |= (samplerateIndex & 0x0e) >> 1;
    config[1] |= (samplerateIndex & 0x01) << 7;
    config[1] |= aacTrack.channel << 3;
    if (adtsObjectType === 5) {
      config[1] |= (adtsExtensionSampleingIndex & 0x0e) >> 1;
      config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
      config[2] |= 2 << 2;
      config[3] = 0;
    }
    aacTrack.config = config;
    aacTrack.codec = 'mp4a.40.' + adtsObjectType;
  }

  getFrameDuration(samplerate) {
    return (1024 * 90000) / samplerate;
  }
}

import {PipeLine, Logger} from 'vod-fp-utility';
import {FREQUENCIES_MAP} from "../default"
import {ERROR, withMessage} from "../error"
import {geneAudioTrackConfig} from "../utils/index"
let logger = new Logger('mux');

export default class FlvAudioTagStream extends PipeLine {

  constructor() {
    super();
    this.audioTrack = null;
  }

  push(data) {
    if (data.tagType === 8) {
      let {encrypted, payload, ts} = data
      this._parseFlvPaylod(payload, encrypted, ts)
    }
  }

  flush() {
    logger.log('audioTrack', this.audioTrack)
    this.emit('data', this.audioTrack)
    this.audioTrack = null;
    this.emit('done')
  }

  _parseFlvPaylod(buffer, encrypted, ts) {

    // parse header,encryption,filterPrams first
    let audioHeaderInfo = this._parseAudioTagHeader(buffer)
    if (encrypted) {
      this._parseEncryptionHeader();
      this._parseFilterParams();
    }
    this._parseAudioData(buffer.subarray(2), encrypted, audioHeaderInfo, ts)

  }

  _parseAudioTagHeader(buffer) {
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
    return {soundFormat, soundRate, soundSize, soundType, aacPacketType}
  }

  _parseAudioData(buffer, encrypted, metadata, ts) {
    let {soundFormat, aacPacketType} = metadata;
    if (!buffer.byteLength) 
      return;
    if (encrypted) {
      // the audio data body is EncryptedBody
    } else {
      if (soundFormat === 10) {
        // aac
        if (aacPacketType === 0) {
          //AudioSpecificConfig
          logger.warn('AudioSpecificConfig')
          let audioConfig = this._parseAudioSpecificConfig(buffer);
          this.audioTrack = this._geneAudioTrack(audioConfig);
        } else {
          // raw aac frame data in UI8 []
          if (this.audioTrack) {
            this
              .audioTrack
              .samples
              .push({dts: ts, pts: ts, data: buffer})
            this.audioTrack.len += buffer.byteLength;
          }
        }
      } else {}
    }
  }

  _parseAudioSpecificConfig(buffer) {
    /**
    *  audioObjectType    5bit
    *  samplingFrquecyIndex   4bit
    *  if(samplingFrquencyIndex === 0xf)
    *     samplingFrequency   24bit
    *  channelConfiguration   4bit |01111000|
    */
    let aObjectT = buffer[0] >> 3;
    let samplingFrquecyIndex = ((buffer[0] & 0x07) << 1) | (buffer[1] >> 7)
    let samplingFrequency;
    let channelConfiguration;
    if (samplingFrquecyIndex === 0xf) {
      if (buffer.byteLength < 5) {
        this.emit('error', withMessage(ERROR.PARSE_ERROR, 'contain samplingFrequency, at least 5 byte need'))
      }
      samplingFrequency = ((buffer[1] & 0x7f) << 17) | (buffer[2] << 9) | (buffer[3] << 1) | ((buffer[4] & 0x80) >> 7);
      channelConfiguration = (buffer[4] & 0x78) >> 3;
    }
    channelConfiguration = (buffer[1] & 0x78) >> 3;

    let {config, audioObjectType} = geneAudioTrackConfig(aObjectT, samplingFrquecyIndex, channelConfiguration);

    return {config, audioObjectType, samplingFrquecyIndex, samplingFrequency, channelConfiguration}
  }

  _parseEncryptionHeader() {}

  _parseFilterParams() {}

  _geneAudioTrack(audioConfig) {
    let {config, audioObjectType, channelConfiguration, samplingFrquecyIndex} = audioConfig;
    return {
      samples: [],
      config,
      type: 'audio',
      len: 0,
      samplerate: 0,
      samplerateIndex: samplingFrquecyIndex,
      samplerate: FREQUENCIES_MAP[samplingFrquecyIndex],
      timescale: FREQUENCIES_MAP[samplingFrquecyIndex],
      channel: channelConfiguration,
      codec: 'mp4a.40.' + audioObjectType
    }
  }

}

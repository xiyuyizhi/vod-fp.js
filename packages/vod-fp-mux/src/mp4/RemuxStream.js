import { PipeLine, Logger } from 'vod-fp-utility';
import { ERROR, withMessage } from '../error';
import AAC from '../utils/aac';
import { checkCombine } from '../utils/index';

let logger = new Logger('mux');

export default class RemuxStream extends PipeLine {
  constructor() {
    super();
    this.combine = true;
    this.trackLen = 0;
    this.incomeTrackLen = 0;
    this.audioTrack = null;
    this.videoTrack = null;
    this.timeOffset = undefined;
    this.on('timeOffset', offset => {
      logger.log('set time offset', offset);
      this.timeOffset = offset;
    });
  }

  push(track) {
    if (track && track.type === 'metadata') {
      this.trackLen = Object.keys(track.data).filter(
        x => track.data[x] !== -1
      ).length;
      this.combine = checkCombine(track.data);
      this.emit('data', track);
      return;
    }
    if (track) {
      this.incomeTrackLen += 1;
      this[`${track.type}Track`] = track;
      this.emit('data', track);
    }
  }

  flush() {
    if (!this.audioTrack && !this.videoTrack) {
      this.emit('done');
      return;
    }
    if (this.incomeTrackLen === this.trackLen) {
      const { audioTrack, videoTrack } = this;
      let audioTimeOffset = this.timeOffset || 0;
      let videoTimeOffset = this.timeOffset || 0;
      if (
        videoTrack &&
        audioTrack &&
        videoTrack.samples.length &&
        audioTrack.samples.length
      ) {
        let firstVideoSampleDts = videoTrack.samples[0].dts;
        let audiovideoDeltaDts = Math.min(
          (audioTrack.samples[0].dts - videoTrack.samples[0].dts) /
            videoTrack.inputTimeScale,
          (audioTrack.samples[0].pts - videoTrack.samples[0].pts) /
            videoTrack.inputTimeScale
        );
        if (Math.abs(audiovideoDeltaDts) >= 0.5) {
          logger.warn('音视频first dts差距过大');
          //可能存在视频非开始于关键帧，在上一阶段丢弃了那些关键帧之前的，导致音视频dts差距过大
          audioTrack.samples = audioTrack.samples.filter(
            sample => sample.dts >= firstVideoSampleDts
          );
          audiovideoDeltaDts = 0;
        }
        //以小的为基准
        audioTimeOffset += Math.max(0, audiovideoDeltaDts);
        videoTimeOffset += Math.max(0, -audiovideoDeltaDts);
        logger.log(
          '音,视频第一采样delta: ',
          audioTimeOffset,
          videoTimeOffset,
          audiovideoDeltaDts,
          'timeoffset: ',
          this.timeOffset
        );
        this.emit('data', {
          videoTimeOffset,
          audioTimeOffset,
          timeOffset: this.timeOffset,
          contiguous: this.timeOffset === undefined
        });
      } else if (videoTrack || audioTrack) {
        if (this.combine && !audioTrack.samples.length) {
          //mock audio track info
          this.emit('data', this.mockAudioTrack(videoTrack, audioTrack));
        }
        this.emit('data', {
          audioTimeOffset,
          videoTimeOffset,
          timeOffset: this.timeOffset,
          contiguous: this.timeOffset === undefined
        });
      } else {
        logger.warn('不存在采样,应该是缺少IDR帧');
        this.emit(
          'error',
          withMessage(ERROR.PARSE_ERROR, 'no found idr frame')
        );
        return;
      }
      this.emit('done');
      this.timeOffset = undefined;
      this.audioTrack = null;
      this.videoTrack = null;
      this.incomeTrackLen = 0;
    }
  }

  mockAudioTrack(videoTrack, audioTrack) {
    let { samples } = videoTrack;
    let track = audioTrack;
    let samplerate = 44100;
    let frameDuration = (1024 * 90000) / samplerate;
    track.sequenceNumber = videoTrack.sequenceNumber;
    track.samplerate = samplerate;
    track.timescale = samplerate;
    track.config = [18, 16];
    track.channel = 2;
    track.frameDuration = frameDuration;
    track.codec = 'mp4a.40.2';

    let startDTS = samples[0].dts;
    let ednDTS = samples[samples.length - 1].dts;
    let nbSamples = (ednDTS - startDTS) / frameDuration;
    let silentFrame = AAC.getSilentFrame(track.codec, track.channel);
    let samps = [];
    for (let i = 0; i < nbSamples; i++) {
      let stamp = startDTS + i * frameDuration;
      samps.push({ data: silentFrame, pts: stamp, dts: stamp });
      track.len += silentFrame.byteLength;
    }
    track.samples = samps;
    logger.warn('mock audio track', track);
    return track;
  }
}

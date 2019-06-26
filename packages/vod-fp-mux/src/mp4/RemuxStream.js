import { PipeLine, Logger } from 'vod-fp-utility';
import { NOT_FOUNT_IDR_FRAME } from "../error"
let logger = new Logger('mux');

export default class RemuxStream extends PipeLine {
  constructor() {
    super();
    this.trackLen = 0;
    this.incomeTrackLen = 0;
    this.audioTrack = null;
    this.videoTrack = null;
    this.timeOffset = undefined;
    this.on('timeOffset', offset => {
      this.timeOffset = offset;
    });
  }

  push(track) {
    if (!track) return;
    if (track.type === 'metadata') {
      this.trackLen = Object.values(track.data).filter(x => x !== -1).length;
      this.emit('data', track);
      return;
    }
    this.incomeTrackLen += 1;
    this[`${track.type}Track`] = track;
    this.emit('data', track);
  }

  flush() {
    if (!this.audioTrack && !this.videoTrack) {
      this.emit('done');
      return;
    }
    if (this.incomeTrackLen === this.trackLen) {
      this.incomeTrackLen = 0;
      const { audioTrack, videoTrack } = this;
      let audioTimeOffset = this.timeOffset || 0;
      let videoTimeOffset = this.timeOffset || 0;
      if (videoTrack && audioTrack) {
        let firstVideoSampleDts = videoTrack.samples[0].dts;
        let audiovideoDeltaDts =
          (audioTrack.samples[0].dts - videoTrack.samples[0].dts) /
          videoTrack.inputTimeScale;
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
          audiovideoDeltaDts
        );
        this.emit('data', {
          videoTimeOffset,
          audioTimeOffset,
          contiguous: this.timeOffset === undefined
        });
      } else if (videoTrack || audioTrack) {
        this.emit('data', {
          audioTimeOffset,
          videoTimeOffset,
          contiguous: this.timeOffset === undefined
        });
      } else {
        logger.warn('不存在采样,应该是缺少IDR帧');
        this.emit('error', NOT_FOUNT_IDR_FRAME);
      }
      this.emit('done');
      this.timeOffset = undefined;
      this.audioTrack = null;
      this.videoTrack = null;
    }
  }
}

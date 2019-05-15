import { PipeLine } from 'vod-fp-utility';
import { logger } from "../utils/logger"
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
    })
  }

  push(track) {
    if (track.type === 'metadata') {
      this.trackLen = Object.keys(track.data).length;
      return;
    }
    this.incomeTrackLen += 1;
    this[`${track.type}Track`] = track;
    this.emit('data', track);
  }

  flush() {
    if (this.incomeTrackLen === this.trackLen) {
      this.incomeTrackLen = 0;
      const { audioTrack, videoTrack } = this;
      let audioTimeOffset = this.timeOffset || 0;
      let videoTimeOffset = this.timeOffset || 0;
      let audiovideoDeltaDts =
        (audioTrack.samples[0].dts - videoTrack.samples[0].dts) /
        videoTrack.inputTimeScale;
      //以小的为基准
      audioTimeOffset += Math.max(0, audiovideoDeltaDts);
      videoTimeOffset += Math.max(0, -audiovideoDeltaDts);
      logger.log('音视频第一采样delta: ', audioTimeOffset, videoTimeOffset);
      this.emit('data', { audioTimeOffset, videoTimeOffset, contiguous: this.timeOffset === undefined });
      this.emit('done');
      this.timeOffset = undefined;
      this.audioTrack = null;
      this.videoTrack = null;
    }
  }
}

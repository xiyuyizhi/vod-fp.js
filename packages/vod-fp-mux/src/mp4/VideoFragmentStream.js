import {PipeLine} from 'vod-fp-utility';
import MP4 from '../utils/Mp4Box';
import ptsNormalize from '../utils/ptsNormalize';
import Logger from '../utils/logger';

let logger = new Logger('VideoFragmentStream')

export default class VideoFragmentStream extends PipeLine {
  constructor() {
    super();
    this.avcTrack = null;
    this.initSegmentGenerate = false;
    this.initSegment = new Uint8Array();
    this.nextAvcDts = 0;
    this.initDTS = 0;
    this.mp4SampleDuration = 0;
    this.on('resetInitSegment', () => this.initSegmentGenerate = false)
    this.on('sequenceNumber', sequenceNumber => this.sequenceNumber = sequenceNumber)
  }

  push(data) {
    if (data.type === 'video') {
      this.avcTrack = data;
      if (!this.initSegmentGenerate) {
        this.initSegmentGenerate = true;
        this.initSegment = MP4.initSegment([data]);
      }
    }
    if (data.videoTimeOffset !== undefined) {
      this.avcTrack['sequenceNumber'] = this.sequenceNumber;
      this.remuxVideo(this.avcTrack, data.videoTimeOffset, data.contiguous);
    }
  }

  flush() {
    // this.avcTrack = null;
    this.initSegment = new Uint8Array();
    this.emit('done');
  }

  remuxVideo(avcTrack, timeOffset, contiguous) {
    let samples = avcTrack.samples;
    let nbSamples = samples.length;
    let nextAvcDts = this.nextAvcDts;

    if (!this.initDTS) {
      this.initDTS = avcTrack.samples[0].dts;
    }

    samples.forEach(sample => {
      sample.originPts = sample.pts;
      sample.originDts = sample.dts;
      sample.pts = ptsNormalize(sample.pts - this.initDTS, timeOffset * avcTrack.inputTimeScale);
      sample.dts = ptsNormalize(sample.dts - this.initDTS, timeOffset * avcTrack.inputTimeScale);
    });

    if (!nextAvcDts) {
      nextAvcDts = avcTrack.samples[0].dts;
    }
    if (!contiguous) {
      nextAvcDts = timeOffset * avcTrack.inputTimeScale;
    }
    // ----------------------           | delta | // 需往前偏移 nextAvcDts samples[0]
    let delta = samples[0].dts - nextAvcDts;

    logger.log(`originPts:${samples[0].originPts} , dts:${samples[0].dts} , nextAvcDts:${nextAvcDts} , delta:${delta} , mp4SampleDuration:${this.mp4SampleDuration}`);
    if (nextAvcDts && samples[0].dts - nextAvcDts >= this.mp4SampleDuration) {
      logger.warn(`两个分片之间差了 ${ (samples[0].dts - nextAvcDts) / this.mp4SampleDuration} 帧！`);
    }
    samples.forEach(sample => {
      sample.dts -= delta;
      sample.pts -= delta;
    });
    // 按dts排序
    samples.sort(function (a, b) {
      const deltadts = a.dts - b.dts;
      const deltapts = a.pts - b.pts;
      return deltadts || deltapts;
    });

    logger.warn(`video remux:【initDTS:${this.initDTS} , nextAvcDts:${nextAvcDts}, samples[0]:${samples[0].dts}】`)

    let sample = samples[0];
    let firstDTS = Math.max(sample.dts, 0);
    let firstPTS = Math.max(sample.pts, 0);

    sample = samples[samples.length - 1];
    let lastDTS = Math.max(sample.dts, 0);
    let lastPTS = Math.max(sample.pts, 0, lastDTS);

    let nbNalu = 0;
    let accessUnitsLen = 0;
    for (let i = 0; i < nbSamples; i++) {
      // compute total/avc sample length and nb of NAL units
      let sample = samples[i];
      let units = sample.units;
      let nbUnits = units.length;
      let sampleLen = 0;
      for (let j = 0; j < nbUnits; j++) {
        sampleLen += units[j].data.length;
      }

      accessUnitsLen += sampleLen;
      nbNalu += nbUnits;
      sample.length = sampleLen;
      sample.pts = Math.max(sample.pts, sample.dts);
    }

    let mdatSize = accessUnitsLen + 4 * nbNalu + 8;
    let mdat = new Uint8Array(mdatSize);
    let view = new DataView(mdat.buffer);
    view.setUint32(0, mdatSize); // mdatSize 占 4byte
    mdat.set(MP4.types.mdat, 4);

    let offset = 8;
    let compositionTimeOffset;
    let mp4Samples = [];
    for (let i = 0; i < nbSamples; i++) {
      let avcSample = samples[i];
      let avcSampleUnits = avcSample.units;
      let mp4SampleLength = 0;
      let compositionTimeOffset;
      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      for (let j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
        let unit = avcSampleUnits[j];
        let unitData = unit.data;
        let unitDataLen = unit.data.byteLength;
        view.setUint32(offset, unitDataLen);
        offset += 4;
        mdat.set(unitData, offset);
        offset += unitDataLen;
        mp4SampleLength += 4 + unitDataLen;
      }
      if (i < nbSamples - 1) {
        this.mp4SampleDuration = samples[i + 1].dts - avcSample.dts;
      } else {
        let lastFrameDuration = avcSample.dts - samples[i > 0
            ? i - 1
            : i].dts;
        this.mp4SampleDuration = lastFrameDuration;
      }
      compositionTimeOffset = Math.round(avcSample.pts - avcSample.dts);

      mp4Samples.push({
        size: mp4SampleLength,
        // constant duration
        duration: this.mp4SampleDuration,
        cts: compositionTimeOffset,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: avcSample.key
            ? 2
            : 1,
          isNonSync: avcSample.key
            ? 0
            : 1
        }
      });
    }
    this.nextAvcDts = lastDTS + this.mp4SampleDuration;
    avcTrack.samples = mp4Samples;
    let moof = MP4.moof(avcTrack.sequenceNumber, firstDTS, avcTrack);
    let bf = new Uint8Array(this.initSegment.byteLength + moof.byteLength + mdat.byteLength);
    bf.set(this.initSegment, 0);
    bf.set(moof, this.initSegment.byteLength);
    bf.set(mdat, this.initSegment.byteLength + moof.byteLength);
    this.emit('data', {
      type: 'video',
      buffer: bf,
      startPTS: firstPTS,
      startDTS: firstDTS,
      endPTS: lastPTS + this.mp4SampleDuration,
      endDTS: this.nextAvcDts
    });
    bf = null;
  }
}

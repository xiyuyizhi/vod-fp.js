import { PipeLine, Logger } from 'vod-fp-utility';
import MP4 from '../utils/Mp4Box';
import { checkCombine } from '../utils/index';
import ptsNormalize from '../utils/ptsNormalize';
import { SAMPLES_EMPTY } from '../error';

let logger = new Logger('mux');

export default class VideoFragmentStream extends PipeLine {
  constructor() {
    super();
    this.combine = false;
    this.avcTrack = null;
    this.initSegmentGenerate = false;
    this.discontinuity = false;
    this.initSegment = new Uint8Array();
    this.nextAvcDts = undefined;
    this.initDTS = 0;
    this.mp4SampleDuration = 0;
    this.on('resetInitSegment', () => (this.initSegmentGenerate = false));
    this.on('setDisContinuity', () => (this.discontinuity = true));
    this.on(
      'sequenceNumber',
      sequenceNumber => (this.sequenceNumber = sequenceNumber)
    );
  }

  push(data) {
    if (data.type === 'metadata') {
      this.combine = checkCombine(data.data);
      return;
    }
    if (data.type === 'video') {
      this.avcTrack = data;
      if (!this.initSegmentGenerate) {
        try {
          logger.log('video gene init segment...');
          this.initSegment = MP4.initSegment([data]);
          this.initSegmentGenerate = true;
        } catch (e) {}
      }
    }
    if (this.avcTrack && data.videoTimeOffset !== undefined) {
      this.avcTrack['sequenceNumber'] = this.sequenceNumber;
      let { samples, inputTimeScale } = this.avcTrack;
      let timeOffset = data.timeOffset;
      if ((!this.initDTS || this.discontinuity) && samples.length) {
        this.initDTS = samples[0].dts - inputTimeScale * (timeOffset || 0);
        this.discontinuity = false;
        logger.log('set video initDTS:', this.initDTS);
      }
      this.remuxVideo(this.avcTrack, data.videoTimeOffset, data.contiguous);
    }
  }

  flush() {
    this.initSegment = new Uint8Array();
    this.emit('done');
  }

  remuxVideo(avcTrack, timeOffset, contiguous) {
    let samples = avcTrack.samples;
    let nbSamples = samples.length;
    let nextAvcDts = this.nextAvcDts;
    if (!nbSamples) {
      let err = {
        ...SAMPLES_EMPTY
      };
      err.message += 'video';
      this.emit('error', err);
      return;
    }
    if (!nextAvcDts) {
      nextAvcDts = 0;
    }

    if (!contiguous) {
      nextAvcDts = timeOffset * avcTrack.inputTimeScale;
      logger.warn(
        `no contiguous,timeOffset = ${timeOffset} ,nextAvcDts =${nextAvcDts} `
      );
    }

    samples.forEach(sample => {
      sample.originPts = sample.pts;
      sample.originDts = sample.dts;
      sample.pts = ptsNormalize(sample.pts - this.initDTS, nextAvcDts);
      sample.dts = ptsNormalize(sample.dts - this.initDTS, nextAvcDts);
    });

    // 按dts排序
    samples.sort(function(a, b) {
      const deltadts = a.dts - b.dts;
      const deltapts = a.pts - b.pts;
      return deltadts || deltapts;
    });

    logger.warn(
      `video remux:【initDTS:${
        this.initDTS
      } , nextAvcDts:${nextAvcDts}, samples[0]: dts - ${
        samples[0].dts
      }  pts - ${samples[0].pts}】`
    );

    let sample = samples[0];
    let delta;
    let firstDTS = Math.max(sample.dts, 0);
    let firstPTS = Math.max(sample.pts, 0);
    logger.log(`firstDTS: ${firstDTS} , firstPTS: ${firstPTS}`);
    // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
    delta = Math.round((firstDTS - nextAvcDts) / 90);
    // if fragment are contiguous, detect hole/overlapping between fragments
    if (contiguous) {
      if (delta) {
        if (delta > 1) {
          logger.log(
            `AVC:${delta} ms hole between fragments detected,filling it`
          );
        } else if (delta < -1) {
          logger.log(`AVC:${-delta} ms overlapping between fragments detected`);
        }

        // remove hole/gap : set DTS to next expected DTS
        firstDTS = nextAvcDts;
        samples[0].dts = firstDTS;
        // offset PTS as well, ensure that PTS is smaller or equal than new DTS
        firstPTS = Math.max(firstPTS - delta, nextAvcDts);
        samples[0].pts = firstPTS;
        logger.log(
          `Video/PTS/DTS adjusted: ${Math.round(firstPTS / 90)}/${Math.round(
            firstDTS / 90
          )},delta:${delta} ms`
        );
      }
    }

    samples.sort(function(a, b) {
      const deltadts = a.dts - b.dts;
      const deltapts = a.pts - b.pts;
      return deltadts || deltapts;
    });

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
        let lastFrameDuration = avcSample.dts - samples[i > 0 ? i - 1 : i].dts;
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
          dependsOn: avcSample.key ? 2 : 1,
          isNonSync: avcSample.key ? 0 : 1
        }
      });
    }
    this.nextAvcDts = lastDTS + this.mp4SampleDuration;
    avcTrack.samples = mp4Samples;
    let moof = MP4.moof(avcTrack.sequenceNumber, firstDTS, avcTrack);
    let bf = new Uint8Array(
      this.initSegment.byteLength + moof.byteLength + mdat.byteLength
    );
    bf.set(this.initSegment, 0);
    bf.set(moof, this.initSegment.byteLength);
    bf.set(mdat, this.initSegment.byteLength + moof.byteLength);
    let endPTS = lastPTS + this.mp4SampleDuration;
    this.emit('data', {
      combine: this.combine,
      type: 'video',
      buffer: bf,
      startPTS: firstPTS,
      startDTS: firstDTS,
      endPTS,
      endDTS: this.nextAvcDts,
      videoInfo: {
        codec: avcTrack.codec,
        width: avcTrack.width,
        height: avcTrack.height,
        profileIdc: avcTrack.profileIdc % 256,
        levelIdc: avcTrack.levelIdc % 256,
        fps: parseInt(90000 / this.mp4SampleDuration),
        timeline: {
          start: firstPTS / 90000,
          end: endPTS / 90000
        }
      }
    });
    bf = null;
  }
}

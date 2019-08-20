import {PipeLine, Logger} from 'vod-fp-utility';
import MP4 from '../utils/Mp4Box';
import AAC from '../utils/aac';
import {checkCombine} from '../utils/index';
import ptsNormalize from '../utils/ptsNormalize';
import {ERROR, withMessage} from '../error';

let logger = new Logger('mux');

const TIME_SCALE = 90000;

export default class AudioFragmentStream extends PipeLine {
  constructor() {
    super();
    this.combine = false;
    this.nextAacDts = 0;
    this.initDTS = 0;
    this.discontinuity = false;
    this.initSegmentGenerate = false;
    this.initSegment = new Uint8Array();
    this.aacTrack = null;
    this.on('resetInitSegment', () => (this.initSegmentGenerate = false));
    this.on('setDisContinuity', () => (this.discontinuity = true));
    this.on('sequenceNumber', sequenceNumber => (this.sequenceNumber = sequenceNumber));
  }

  push(data) {
    if (data.type === 'metadata') {
      this.combine = checkCombine(data.data);
      return;
    }
    if (data.type === 'audio') {
      this.aacTrack = data;
      if (!this.initSegmentGenerate) {
        try {
          logger.log('audio gene init segment...');
          this.initSegment = MP4.initSegment([data]);
          this.initSegmentGenerate = true;
        } catch (e) {}
      }
    }

    if (this.aacTrack && data.audioTimeOffset !== undefined) {
      this.aacTrack['sequenceNumber'] = this.sequenceNumber;
      let {samples, inputTimeScale} = this.aacTrack;
      let timeOffset = data.timeOffset;
      if ((!this.initDTS || this.discontinuity) && samples.length) {
        this.initDTS = samples[0].dts - 90000 * (timeOffset || 0);
        this.discontinuity = false;
        logger.log('set audio initDTS:', this.initDTS);
      }
      this.remuxAudio(this.aacTrack, data.audioTimeOffset, data.contiguous);
    }
  }

  flush() {
    this.initSegment = new Uint8Array();
    this.emit('done');
  }

  remuxAudio(aacTrack, timeOffset, contiguous) {
    const scaleFactor = TIME_SCALE / aacTrack.samplerate;
    const sampleDuration = 1024 * scaleFactor;
    let offset;
    let mp4Sample;
    let fillFrame;
    let mdat;
    let moof;
    let firstPTS;
    let lastPTS;
    let inputSamples = aacTrack.samples;
    let outputSamples = [];
    let nextAudioDts = this.nextAacDts;

    if (!inputSamples.length) {
      this.emit('error', withMessage(ERROR.PARSE_ERROR, 'audio samples is empty'));
      return;
    }
    logger.warn('audio,nextAudioDts,', nextAudioDts);
    inputSamples.forEach(sample => {
      sample.originPts = sample.pts;
      sample.originDts = sample.dts;
      sample.pts = sample.dts = ptsNormalize(sample.pts - this.initDTS, timeOffset * TIME_SCALE);
    });

    if (!nextAudioDts) {
      nextAudioDts = aacTrack.samples[0].dts;
    }
    if (!contiguous || (Math.abs(inputSamples[0].dts - nextAudioDts) / 90000 > 0.1 && Math.abs(inputSamples[0].dts - nextAudioDts) / 90000 < 2)) {
      if (!contiguous) {
        nextAudioDts = timeOffset * TIME_SCALE;
      } else {
        nextAudioDts = inputSamples[0].dts;
      }
      logger.warn(`not contiguous,first sample dts:${inputSamples[0].dts} ,origin dts:${inputSamples[0].originDts},timeOffset = ${timeOffset} ,nextAudioDts =${nextAudioDts}`);
    }

    logger.warn(`audio remux:【initDTS:${this.initDTS} , nextAacPts:${nextAudioDts}, originPTS:${inputSamples[0].originPts} ,  originDTS:${inputSamples[0].originDts} , samples[0]:${inputSamples[0].dts}】`);
    let totalMissingCount = 0;
    let totalDroppingCount = 0;
    for (let i = 0, nextPts = nextAudioDts; i < inputSamples.length;) {
      let sample = inputSamples[i];
      let delta;
      let pts = sample.pts;
      delta = pts - nextPts;
      const duration = Math.abs((1000 * delta) / TIME_SCALE);
      if (delta <= -1 * sampleDuration) {
        totalDroppingCount += 1;
        logger.warn(`Dropping 1 audio frame @ ${ (nextPts / TIME_SCALE).toFixed(3)}s due to ${Math.round(duration)} ms overlap.`);
        inputSamples.splice(i, 1);
        aacTrack.len -= sample.data.length;
      } else if (delta >= sampleDuration && nextPts) {
        let missing = Math.round(delta / sampleDuration);
        totalMissingCount += missing;
        logger.warn(`Injecting ${missing} audio frame @ ${ (nextPts / TIME_SCALE).toFixed(3)}s due to ${Math.round((1000 * delta) / TIME_SCALE)} ms gap.`);
        for (let j = 0; j < missing; j++) {
          let newStamp = Math.max(nextPts, 0);
          fillFrame = AAC.getSilentFrame(aacTrack.manifestCodec || aacTrack.codec, aacTrack.channel);
          if (!fillFrame) {
            logger.log('Unable to get silent frame for given audio codec; duplicating last frame instead' +
                '.');
            fillFrame = sample
              .data
              .subarray();
          }
          inputSamples.splice(i, 0, {
            data: fillFrame,
            pts: newStamp,
            dts: newStamp
          });
          aacTrack.len += fillFrame.length;
          nextPts += sampleDuration;
          i++;
        }
      } else {
        sample.pts = sample.dts = nextPts;
        nextPts += sampleDuration;
        i++;
      }
    }
    for (let j = 0, nbSamples = inputSamples.length; j < nbSamples; j++) {
      let audioSample = inputSamples[j];
      let unit = audioSample.data;
      let pts = audioSample.pts;
      // logger.log(`Audio/PTS:${Math.round(pts/90)}`); if not first sample
      if (lastPTS !== undefined) {
        mp4Sample.duration = Math.round((pts - lastPTS) / scaleFactor);
      } else {
        let delta = Math.round((1000 * (pts - nextAudioDts)) / TIME_SCALE);
        let numMissingFrames = 0;

        // remember first PTS of our audioSamples
        firstPTS = pts;
        if (aacTrack.len > 0) {
          /* concatenate the audio data and construct the mdat in place
                    (need 8 more bytes to fill length and mdat type) */
          let mdatSize = aacTrack.len + 8;
          offset = 8;
          mdat = new Uint8Array(mdatSize);
          const view = new DataView(mdat.buffer);
          view.setUint32(0, mdatSize);
          mdat.set(MP4.types.mdat, 4);
        } else {
          // no audio samples
          return;
        }
      }
      mdat.set(unit, offset);
      let unitLen = unit.byteLength;
      offset += unitLen;

      mp4Sample = {
        size: unitLen,
        cts: 0,
        duration: 0,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: 1
        }
      };
      outputSamples.push(mp4Sample);
      lastPTS = pts;
    }
    logger.log('audio samples', outputSamples);
    let lastSampleDuration = 0;
    let nbSamples = outputSamples.length;
    // set last sample duration as being identical to previous sample
    if (nbSamples >= 2) {
      lastSampleDuration = outputSamples[nbSamples - 2].duration;
      mp4Sample.duration = lastSampleDuration;
    }
    if (nbSamples) {
      // next audio sample PTS should be equal to last sample PTS + duration
      this.nextAacDts = lastPTS + scaleFactor * lastSampleDuration;
      // logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' +
      // this.nextAacDts.toFixed(0));
      aacTrack.len = 0;
      aacTrack.samples = outputSamples;
      moof = MP4.moof(aacTrack.sequenceNumber, firstPTS / scaleFactor, aacTrack);

      aacTrack.samples = [];
      const start = firstPTS / TIME_SCALE;
      const end = this.nextAacDts / TIME_SCALE;
      // const audioData = {   data1: moof,   data2: mdat,   startPTS: start, endPTS:
      // end,   startDTS: start,   endDTS: end,   nb: nbSamples };
      let bf = new Uint8Array(this.initSegment.byteLength + moof.byteLength + mdat.byteLength);
      bf.set(this.initSegment, 0);
      bf.set(moof, this.initSegment.byteLength);
      bf.set(mdat, this.initSegment.byteLength + moof.byteLength);
      this.emit('data', {
        combine: this.combine,
        type: 'audio',
        buffer: bf,
        startPTS: firstPTS,
        startDTS: firstPTS,
        endPTS: this.nextAacDts,
        endDTS: this.nextAacDts,
        totalMissingCount,
        totalDroppingCount,
        audioInfo: {
          codec: aacTrack.codec,
          samplerate: aacTrack.samplerate,
          timeline: {
            start: firstPTS / 90000,
            end: this.nextAacDts / 90000
          }
        }
      });
      bf = null;
    }
  }
}

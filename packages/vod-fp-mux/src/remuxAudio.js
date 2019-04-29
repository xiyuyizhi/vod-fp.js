import MP4 from './Mp4Box';
import AAC from './aac';

const logger = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const TIME_SCALE = 90000;
let nextAacDts = 0;
let _audioInitDts = 0;

function ptsNormalize(value, reference) {
  let offset;
  if (reference === undefined) {
    return value;
  }

  if (reference < value) {
    // - 2^33
    offset = -8589934592;
  } else {
    // + 2^33
    offset = 8589934592;
  }
  /* PTS is 33bit (from 0 to 2^33 -1)
      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
      PTS looping occured. fill the gap */
  while (Math.abs(value - reference) > 4294967296) {
    value += offset;
  }
  return value;
}

function remuxAudio(aacTrack, initSegment, timeOffset) {
  if (!_audioInitDts) {
    _audioInitDts = aacTrack.samples[0].dts;
  }
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
  let nextAudioPts = nextAacDts;

  inputSamples.forEach(function(sample) {
    sample.pts = sample.dts = ptsNormalize(
      sample.pts - _audioInitDts,
      timeOffset * TIME_SCALE
    );
  });
  inputSamples = inputSamples.filter(function(sample) {
    return sample.pts >= 0;
  });
  if (inputSamples.length === 0) {
    return;
  }

  for (let i = 0, nextPts = nextAudioPts; i < inputSamples.length; ) {
    let sample = inputSamples[i];
    let delta;
    let pts = sample.pts;
    delta = pts - nextPts;
    const duration = Math.abs((1000 * delta) / TIME_SCALE);
    if (delta <= -1 * sampleDuration) {
      logger.warn(
        `Dropping 1 audio frame @ ${(nextPts / TIME_SCALE).toFixed(
          3
        )}s due to ${Math.round(duration)} ms overlap.`
      );
      inputSamples.splice(i, 1);
      aacTrack.len -= sample.data.length;
    } else if (delta >= sampleDuration && nextPts) {
      let missing = Math.round(delta / sampleDuration);
      logger.warn(
        `Injecting ${missing} audio frame @ ${(nextPts / TIME_SCALE).toFixed(
          3
        )}s due to ${Math.round((1000 * delta) / TIME_SCALE)} ms gap.`
      );
      for (let j = 0; j < missing; j++) {
        let newStamp = Math.max(nextPts, 0);
        fillFrame = AAC.getSilentFrame(
          aacTrack.manifestCodec || aacTrack.codec,
          aacTrack.channelCount
        );
        if (!fillFrame) {
          logger.log(
            'Unable to get silent frame for given audio codec; duplicating last frame instead.'
          );
          fillFrame = sample.data.subarray();
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
    // logger.log(`Audio/PTS:${Math.round(pts/90)}`);
    // if not first sample
    if (lastPTS !== undefined) {
      mp4Sample.duration = Math.round((pts - lastPTS) / scaleFactor);
    } else {
      let delta = Math.round((1000 * (pts - nextAudioPts)) / TIME_SCALE);
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
    // console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${audioSample.pts}/${audioSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(audioSample.pts/4294967296).toFixed(3)}');
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
    nextAacDts = lastPTS + scaleFactor * lastSampleDuration;
    // logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
    aacTrack.len = 0;
    aacTrack.samples = outputSamples;
    moof = MP4.moof(aacTrack.sequenceNumber, firstPTS / scaleFactor, aacTrack);

    aacTrack.samples = [];
    const start = firstPTS / TIME_SCALE;
    const end = nextAacDts / TIME_SCALE;
    // const audioData = {
    //   data1: moof,
    //   data2: mdat,
    //   startPTS: start,
    //   endPTS: end,
    //   startDTS: start,
    //   endDTS: end,
    //   nb: nbSamples
    // };
    const bf = new Uint8Array(
      initSegment.byteLength + moof.byteLength + mdat.byteLength
    );
    bf.set(initSegment, 0);
    bf.set(moof, initSegment.byteLength);
    bf.set(mdat, initSegment.byteLength + moof.byteLength);
    return bf;
  }
}

export { remuxAudio };

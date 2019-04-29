import MP4 from './Mp4Box';
import { remuxVideo } from './remuxVideo';
import { remuxAudio } from './remuxAudio';

const logger = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

let initSegmentGenerate = false;

function remux(avcTrack, aacTrack, timeOffset) {
  logger.log('avcTrack', avcTrack);
  logger.log('aacTrack', aacTrack);
  let audioTimeOffset = timeOffset;
  let videoTimeOffset = timeOffset;
  let videoInitSegment = new Uint8Array();
  let audioInitSegment = new Uint8Array();
  if (!initSegmentGenerate) {
    videoInitSegment = MP4.initSegment([avcTrack]);
    audioInitSegment = MP4.initSegment([aacTrack]);
    initSegmentGenerate = true;
  }
  logger.warn(
    'segment first sample compare:',
    `【audio: ${aacTrack.samples[0].dts}】【video: ${avcTrack.samples[0].dts}】`
  );
  let audiovideoDeltaDts =
    (aacTrack.samples[0].dts - avcTrack.samples[0].dts) /
    avcTrack.inputTimeScale;
  //以小的为基准
  audioTimeOffset += Math.max(0, audiovideoDeltaDts);
  videoTimeOffset += Math.max(0, -audiovideoDeltaDts);
  return {
    video: remuxVideo(avcTrack, videoInitSegment, videoTimeOffset),
    audio: remuxAudio(aacTrack, audioInitSegment, audioTimeOffset)
  };
}

export { remux };

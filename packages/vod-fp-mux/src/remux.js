import MP4 from './Mp4Box';
import { remuxVideo } from './remuxVideo';
import { remuxAudio } from './remuxAudio';

const logger = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

let initSegmentGenerate = false;

function remux(avcTrack, aacTrack) {
  logger.log('avcTrack', avcTrack);
  logger.log('aacTrack', aacTrack);

  let videoInitSegment = new Uint8Array();
  let audioInitSegment = new Uint8Array();
  if (!initSegmentGenerate) {
    videoInitSegment = MP4.initSegment([avcTrack]);
    audioInitSegment = MP4.initSegment([aacTrack]);
    initSegmentGenerate = true;
  }
  return {
    video: remuxVideo(avcTrack, videoInitSegment),
    audio: remuxAudio(aacTrack, audioInitSegment)
  };
}

export { remux };

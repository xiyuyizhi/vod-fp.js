const FREQUENCIES_MAP = {
  0: 96000,
  1: 88200,
  2: 64000,
  3: 48000,
  4: 44100,
  5: 32000,
  6: 24000,
  7: 22050,
  8: 16000,
  9: 12000,
  10: 11025,
  11: 8000,
  12: 7350
};

function getDefaultAVCTrack() {
  return {
    samples: [],
    inputTimeScale: 90000,
    timescale: 90000,
    id: 1, // video
    type: 'video',
    sequenceNumber: 0,
    pesData: null
  };
}

function getDefaultAACTrack() {
  return {
    samples: [],
    id: 2, // audio
    type: 'audio',
    len: 0,
    samplerate: 0,
    sequenceNumber: 0,
    pesData: null
  };
}

export { FREQUENCIES_MAP, getDefaultAACTrack, getDefaultAVCTrack };

import { F } from 'vod-fp-utility';

const { prop, compose } = F;

export default {
  module: 'BUFFER',
  ACTION: {
    AUDIO_SOURCEBUFFER: 'audioSourceBuffer',
    VIDEO_SOURCEBUFFER: 'videoSourceBuffer',
    AUDIO_BUFFER: 'audioBuffer',
    VIDEO_BUFFER: 'videoBuffer',
    AUDIO_APPENDED: 'audioAppended',
    VIDEO_APPENDED: 'videoAppended'
  },
  state: {
    audioSourceBuffer: null,
    videoSourceBuffer: null,
    audioBuffer: null,
    videoBuffer: null,
    audioAppended: false,
    videoAppended: false
  }
};

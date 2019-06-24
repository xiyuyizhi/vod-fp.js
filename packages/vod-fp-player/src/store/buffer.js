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
    VIDEO_APPENDED: 'videoAppended',
    VIDEO_BUFFER_REMOVE: 'videoBufferRemove',
    AUDIO_BUFFER_REMOVE: 'audioBufferRemove'
  },
  state: {
    audioSourceBuffer: null,
    videoSourceBuffer: null,
    audioBuffer: null,
    videoBuffer: null,
    audioAppended: false,
    videoAppended: false,
    derive: {
      videoBufferRemove: state => {
        return state.map(x => {
          x.videoBuffer = null;
          return x;
        });
      },
      audioBufferRemove: state => {
        return state.map(x => {
          x.audioBuffer = null;
          return x;
        });
      }
    }
  }
};

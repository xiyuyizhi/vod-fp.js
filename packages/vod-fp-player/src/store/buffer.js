import { F } from 'vod-fp-utility';

const { prop, compose } = F;

export default {
  module: 'BUFFER',
  ACTION: {
    AUDIO_SOURCEBUFFER: 'audioSourceBuffer',
    VIDEO_SOURCEBUFFER: 'videoSourceBuffer',
    AUDIO_BUFFER_INFO: 'audioBufferInfo',
    VIDEO_BUFFER_INFO: 'videoBufferInfo',
    AUDIO_APPENDED: 'audioAppended',
    VIDEO_APPENDED: 'videoAppended',
    VIDEO_BUFFER_REMOVE: 'videoBufferRemove',
    AUDIO_BUFFER_REMOVE: 'audioBufferRemove'
  },
  getState() {
    return {
      audioSourceBuffer: null,
      videoSourceBuffer: null,
      audioBufferInfo: null,
      videoBufferInfo: null,
      audioAppended: false,
      videoAppended: false,
      derive: {
        videoBufferRemove: state => {
          return state.map(x => {
            x.videoBufferInfo = null;
            return x;
          });
        },
        audioBufferRemove: state => {
          return state.map(x => {
            x.audioBufferInfo = null;
            return x;
          });
        }
      }
    }
  }
};

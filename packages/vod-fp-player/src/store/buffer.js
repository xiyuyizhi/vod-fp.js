import { F } from 'vod-fp-utility';
import { getBufferInfo, getFlyBufferInfo } from '../buffer/buffer-helper';
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
    AUDIO_BUFFER_REMOVE: 'audioBufferRemove',
    GET_BUFFER_INFO: 'getBufferInfo',
    GET_FLY_BUFFER_INFO: 'getFlyBufferInfo'
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
        },
        getBufferInfo(state, payload, { ACTION, getState, connect }) {
          return getState(ACTION.MEDIA.MEDIA_ELE).map(m =>
            connect(getBufferInfo)(m.currentTime, m.seeking)
          );
        },
        getFlyBufferInfo(state, payload, _store) {
          return this.getBufferInfo(null, null, _store).map(relBuffer => {
            return _store.connect(getFlyBufferInfo)(relBuffer.bufferEnd, true);
          });
        }
      }
    };
  }
};

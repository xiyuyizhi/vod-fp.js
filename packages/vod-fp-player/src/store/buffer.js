import { F } from 'vod-fp-utility';
import { getBufferInfo, getFlyBufferInfo } from '../buffer/buffer-helper';
const { prop, compose, map } = F;

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
    VIDEO_INFO: 'videoInfo',
    AUDIO_INFO: 'audioInfo',
    GET_BUFFER_INFO: 'getBufferInfo',
    GET_FLY_BUFFER_INFO: 'getFlyBufferInfo',
    LIVE_LOAD_POINT: 'liveLoadPoint'
  },
  getState() {
    return {
      audioSourceBuffer: null,
      videoSourceBuffer: null,
      audioBufferInfo: null,
      videoBufferInfo: null,
      audioAppended: false,
      videoAppended: false,
      videoInfo: null,
      audioInfo: null,
      liveLoadPoint: -1,
      derive: {
        videoBufferInfo(state, payload) {
          if (payload) {
            return state.map(x => {
              x.videoBufferInfo = payload;
              x.videoInfo = payload.videoInfo || x.videoInfo;
              return x;
            });
          }
          return state.map(prop('videoBufferInfo'));
        },
        audioBufferInfo(state, payload) {
          if (payload) {
            return state.map(x => {
              x.audioBufferInfo = payload;
              x.audioInfo = payload.audioInfo || x.audioInfo;
              return x;
            });
          }
          return state.map(prop('audioBufferInfo'));
        },
        videoBufferRemove(state) {
          return state.map(x => {
            x.videoBufferInfo = null;
            return x;
          });
        },
        audioBufferRemove(state) {
          return state.map(x => {
            x.audioBufferInfo = null;
            return x;
          });
        },
        getBufferInfo(state, payload, { ACTION, getState, connect }) {
          return getState(ACTION.MEDIA.MEDIA_ELE).map(m =>
            connect(getBufferInfo)(m.currentTime)
          );
        },
        getFlyBufferInfo(state, payload, _store) {
          return state.map(prop('liveLoadPoint')).map(liveLoadPoint => {
            if (liveLoadPoint == -1) {
              return this.getBufferInfo(null, null, _store).chain(relBuffer => {
                return _store.connect(getFlyBufferInfo)(relBuffer.bufferEnd);
              });
            }
            return {
              bufferLength: 0,
              bufferStart: liveLoadPoint,
              bufferEnd: liveLoadPoint
            };
          });
        }
      }
    };
  }
};

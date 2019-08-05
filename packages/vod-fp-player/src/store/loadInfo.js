import { F } from 'vod-fp-utility';
const { prop } = F;

export default {
  module: 'LOADINFO',
  ACTION: {
    COLLECT_DOWNLOAD_SPEED: 'collectDownloadSpeed',
    GET_DOWNLOAD_SPEED: 'getDownloadSpeed',
    CURRENT_SEG_DONWLOAD_INFO: 'currentSegmentDownloadInfo'
  },
  getState() {
    return {
      info: null, // {tsRequest,loaded,total}
      speedList: [],
      derive: {
        collectDownloadSpeed(state, speed) {
          return state.map(x => {
            if (x.speedList.length > 10) {
              x.speedList = x.speedList.slice(5);
            }
            x.speedList.push(speed);
            return x;
          });
        },
        getDownloadSpeed(state) {
          return state.map(x => {
            let len = x.speedList.length;
            return (
              x.speedList.reduce((all, c) => {
                all += c;
                return all;
              }, 0) / len
            );
          });
        },
        // MB/s
        currentSegmentDownloadInfo(state, info) {
          if (info !== undefined) {
            return state.map(x => {
              x.info = info;
              return x;
            });
          }
          return state.map(prop('info'));
        }
      }
    };
  }
};

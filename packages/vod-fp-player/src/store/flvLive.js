import { F } from 'vod-fp-utility';

export default {
  module: 'FLVLIVE',
  ACTION: {
    NEW_BUFFER_ARRIVE: 'newBufferArrive'
  },
  getState() {
    return {
      drive: {}
    };
  }
};

import { F } from 'vod-fp-utility';

const { prop, compose } = F;

export default {
  module: 'MEDIA',
  ACTION: {
    MEDIA_ELE: 'mediaEle',
    MEDIA_SOURCE: 'mediaSource'
  },
  getState() {
    return {
      mediaEle: null,
      mediaSource: null,
    }
  }
};

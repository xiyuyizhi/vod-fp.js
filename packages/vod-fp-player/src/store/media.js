import { F } from 'vod-fp-utility';

const { prop, compose } = F;

export default {
  module: 'MEDIA',
  ACTION: {
    MEDIA_ELE: 'mediaEle',
    MEDIA_SOURCE: 'mediaSource'
  },
  state: {
    mediaEle: null,
    mediaSource: null
  }
};

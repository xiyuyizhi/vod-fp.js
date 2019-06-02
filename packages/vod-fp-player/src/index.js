import { EventBus } from 'vod-fp-utility';
import Events from './events';
export default class Vod extends EventBus {
  constructor(options) {
    super();
  }

  static get Events() {
    return Events;
  }

  attachMedia(media) {}

  loadSource(url) {
    console.log(url);
  }

  changeSource() {}
}

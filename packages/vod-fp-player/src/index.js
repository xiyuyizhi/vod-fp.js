import { EventBus } from 'vod-fp-utility';
import Events from './events';
import { createStore, initState, ACTION } from './store';
import manage from './manage';

export default class Vod extends EventBus {
  constructor(options) {
    super();
    this.media = null;
    this.url = '';
    this.store = createStore(initState);
  }

  static get Events() {
    return Events;
  }

  attachMedia(media) {
    this.media = media;
    this.store.dispatch(ACTION.MEDIA.MEDIA_ELE, media);
    this.setUp();
  }

  loadSource(url) {
    this.url = url;
    this.store.dispatch(ACTION.M3U8_URL, url);
    this.setUp();
  }

  setUp() {
    if (this.media && this.url) {
      const { subscribe, connect } = this.store;
      subscribe(ACTION.ERROR, e => {
        this.emit(Events.ERROR, e);
      });
      connect(manage)(this.media, this.url);
    }
  }
}

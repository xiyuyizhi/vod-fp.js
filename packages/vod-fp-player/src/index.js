import { EventBus } from 'vod-fp-utility';
import Events from './events';
import { store, ACTION } from './store';
import manage from './manage';

export default class Vod extends EventBus {
  constructor(options) {
    super();
    this.media = null;
    this.url = '';
    this.store = store();
    console.log(this.store);
  }

  static get Events() {
    return Events;
  }

  attachMedia(media) {
    this.media = media;
    this.store.dispatch(ACTION.COLLECT_MEDIA, media);
    this.setUp();
  }

  loadSource(url) {
    this.url = url;
    this.store.dispatch(ACTION.COLLECT_URL, url);
    this.setUp();
  }

  setUp() {
    if (this.media && this.url) {
      this.store.subscribe(ACTION.ERROR, e => {
        this.emit(Events.ERROR, e);
      });
      manage(this.media, this.url, this.store);
    }
  }
}

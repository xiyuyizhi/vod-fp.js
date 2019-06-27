import { EventBus } from 'vod-fp-utility';
import Events from './events';
import { createStore, getState, ACTION } from './store';
import { manage, changeLevel, destroy } from './manage';

export default class Vod extends EventBus {
  constructor(options) {
    super();
    this.media = null;
    this.url = '';
    let initState = getState();
    initState.config = Object.assign(initState.config, options);
    this.store = createStore(initState, ACTION);
    this._changeLevel = changeLevel();
    window.store = this.store;
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

  changeLevel(levelId) {
    this.store.connect(this._changeLevel)(levelId);
  }

  setUp() {
    if (this.media && this.url) {
      const { subscribe, connect } = this.store;
      Object.keys(ACTION.EVENTS).forEach(eveName => {
        subscribe(ACTION.EVENTS[eveName], data => {
          this.emit(Events[eveName], data.join());
        });
      });
      connect(manage)(this.media, this.url);
    }
  }

  destroy() {
    this.store.connect(destroy);
    this.store.destroy();
    this.store = null;
  }

}

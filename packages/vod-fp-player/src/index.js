import { EventBus } from 'vod-fp-utility';
import Events from './events';
import { createStore, getInitState, ACTION } from './store';
import { CONFIG } from './store/config';
import { manageHls, manageFlvLive, changeLevel, destroy } from './manage';
import { debuger, clearDebuger } from './plugin/debuger';

export default class Vod extends EventBus {
  constructor(options) {
    super();
    this.media = null;
    this.url = '';
    this.debugerContainer = null;
    let initState = getInitState();
    initState.config = Object.assign(initState.config, options);
    window.store = this.store = createStore(initState, ACTION);
    this._changeLevel = changeLevel();
  }

  static get Events() {
    return Events;
  }

  static get Configs() {
    return CONFIG;
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
      const { subscribe, connect, getConfig } = this.store;
      Object.keys(ACTION.EVENTS).forEach(eveName => {
        subscribe(ACTION.EVENTS[eveName], data => {
          this.emit(Events[eveName], data.join());
        });
      });

      if (getConfig(ACTION.CONFIG.FLV_LIVE)) {
        connect(manageFlvLive)(this.media, this.url);
      } else {
        connect(manageHls)(this.media, this.url);
      }
    }
  }

  useDebug(container) {
    this.debugerContainer = container;
    this.store.connect(debuger)(container);
  }

  destroy() {
    this.store.connect(destroy);
    this.store.destroy();
    this.store = null;
    clearDebuger(this.debugerContainer);
  }
}

import {EventBus} from "vod-fp-utility";

export default class Vod extends EventBus {

  constructor(options) {
    super();
  }

  attachMedia(media) {}

  loadSource(url) {
    console.log(url);
  }

}

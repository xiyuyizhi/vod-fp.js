import {PipeLine, Logger} from 'vod-fp-utility';

let logger = new Logger('mux');

export default class FlvDataTagScript extends PipeLine {

  push(data) {
    if (data.tagType === 18) {
      logger.log(data)
    }
  }

}
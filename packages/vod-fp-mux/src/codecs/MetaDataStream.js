import { PipeLine } from 'vod-fp-utility';

export default class MetaDataStream extends PipeLine {
  push(data) {
    if (data.type === 'metadata') {
      this.emit('data', data);
    }
  }
}

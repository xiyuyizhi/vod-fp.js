import { EventBus } from 'vod-fp-utility';
import { TsToMp4 } from 'vod-fp-mux';

export default class WorkerSimulate extends EventBus {
  constructor() {
    super();
    this.mux = new TsToMp4();
    this.muxEvents();
  }

  postMessage(e) {
    let { type, data } = e;
    let mux = this.mux;
    switch (type) {
      case 'resetInitSegment':
        mux.resetInitSegment();
        break;
      case 'setTimeOffset':
        mux.setTimeOffset(data);
        break;
      case 'push':
        mux.push(data.buffer, data.sequeueNum, data.keyInfo);
        mux.flush();
        break;
    }
  }

  muxEvents() {
    let mux = this.mux;
    mux.on('data', data => {
      this.emit('message', {
        data: { type: 'data', data }
      });
    });

    mux.on('error', e => {
      this.emit('message', {
        data: { type: 'error', data: e }
      });
    });
  }
}

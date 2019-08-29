import { EventBus } from 'vod-fp-utility';
import Mux from 'vod-fp-mux';

export default class WorkerSimulate extends EventBus {
  constructor() {
    super();
    this.mux = null;
  }

  postMessage(e) {
    let { type, data } = e;
    let mux = this.mux;
    switch (type) {
      case 'selectDemuxer':
        this.initMuxer(data);
        break;
      case 'resetInitSegment':
        mux.resetInitSegment();
        break;
      case 'setDisContinuity':
        mux.setDisContinuity();
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

  initMuxer(type) {
    let mux;
    if (type === 'flv') {
      mux = new Mux.FlvToMp4();
    }
    if (type === 'ts') {
      mux = new Mux.TsToMp4();
    }
    this.mux = mux;
    mux.on('data', data => {
      this.emit('message', {
        data: {
          type: 'data',
          data
        }
      });
    });
    mux.on('restBufferInfo', data => {
      this.emit('message', {
        data: {
          type: 'restBufferInfo',
          data
        }
      });
    });

    mux.on('error', e => {
      this.emit('message', {
        data: {
          type: 'error',
          data: e
        }
      });
    });
  }
}

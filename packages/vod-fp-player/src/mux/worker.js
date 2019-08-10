import Mux from 'vod-fp-mux';

export default () => {
  let mux = new Mux.TsToMp4();

  mux.on('data', data => {
    self.postMessage({ type: 'data', data });
  });

  mux.on('error', e => {
    self.postMessage({ type: 'error', data: e });
  });
  self.addEventListener('message', e => {
    let { type, data } = e.data;
    switch (type) {
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
  });
};

import EventBus from './EventBus';

export default class PipeLine extends EventBus {
  constructor() {
    super();
  }

  pipe(dest) {
    this.on('data', (...params) => {
      dest.push(...params);
    });
    this.on('done', source => {
      dest.flush(source);
    });
    return dest;
  }

  // override
  push(...params) {
    this.emit('data', ...params);
  }

  // override
  flush(source) {
    this.emit('done', source);
  }
}

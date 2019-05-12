import EventBus from './EventBus';

export default class Pipeline extends EventBus {
  constructor() {
    super();
  }

  pipe(dest) {
    this.on('data', data => {
      dest.push(data);
    });
    this.on('done', source => {
      dest.flush(source);
    });
    return dest;
  }

  // override
  push(data) {
    this.emit('data', data);
  }

  // override
  flush(source) {
    this.emit('done', source);
  }
}

import EventBus from './EventBus';

export default class PipeLine extends EventBus {
  constructor() {
    super();
  }

  pipe(dest) {
    this.on('data', (...params) => {
      try {
        dest.push(...params);
      } catch (e) {
        // bubble error
        dest.emit('error', e)
      }
    });
    this.on('done', source => {
      try {
        dest.flush(source);
      } catch (e) {
        // bubble error
        dest.emit('error', e)
      }
    });
    this.on('error', err => {
      dest.emit('error', err)
    })
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

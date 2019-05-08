import { compose } from './core';
const STATE = {
  PENDING: 'pending',
  FULLFILLED: 'fulfilled',
  REJECTED: 'rejected'
};

class Task {
  constructor(f) {
    this.$state = STATE.PENDING;
    this.resolve = this.resolve.bind(this);
    this.reject = this.reject.bind(this);
    f.apply(null, [this.resolve, this.reject]);
  }

  static of(f) {
    return new Task(f);
  }

  resolve(result) {
    this.$state = STATE.FULLFILLED;
    console.log('result...', result);
  }

  reject(err) {
    this.$state = STATE.REJECTED;
  }

  map(f) {
    return Task.of(
      compose(
        f,
        this.resolve
      )
    );
  }
}

export default Task;

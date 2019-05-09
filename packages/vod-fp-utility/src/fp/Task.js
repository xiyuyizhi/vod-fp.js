import { compose } from './core';
import { Fail, Success } from './Either';
import { defer } from './_inner/defer';

const STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
};

class Task {
  constructor(f) {
    this._value = STATE.PENDING;
    this._queueCall = [];
    this.resolve = this.resolve.bind(this);
    this.reject = this.reject.bind(this);
    f.apply(null, [this.resolve, this.reject]);
  }

  static of(f) {
    return new Task(f);
  }

  _reMount(target, mapList) {
    while (mapList.length) {
      target.map(mapList.shift());
    }
  }

  _deferRun(result, Container) {
    while (this._queueCall.length) {
      let current = this._queueCall.shift();
      result = current(Container.of(result));
      if (result instanceof Task) {
        this._reMount(result, this._queueCall.slice(0));
        this._queueCall = [];
      }
    }
  }

  resolve(result) {
    if (this._value != STATE.PENDING) return;
    defer(() => {
      this._value = STATE.FULFILLED;
      this._deferRun(result, Success);
    });
  }

  reject(result) {
    if (this._value != STATE.PENDING) return;
    defer(() => {
      this._value = STATE.REJECTED;
      this._deferRun(result, Fail);
    });
  }

  map(f) {
    this._queueCall.push(f);
    return this;
  }
}

export default Task;

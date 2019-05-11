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
    this._state = STATE.PENDING;
    this._queueCall = [];
    this._catchCall = null;
    this.resolve = this.resolve.bind(this);
    this.reject = this.reject.bind(this);
    f.apply(null, [this.resolve, this.reject]);
  }

  static of(f) {
    return new Task(f);
  }

  static resolve(x) {
    return Task.of(resolve => resolve(x));
  }

  static reject(x) {
    return Task.of((resolve, reject) => reject(x));
  }

  _removeQueue() {
    this._queueCall = [];
  }

  _reMount(target, mapList) {
    target._removeQueue();
    while (mapList.length) {
      target.map(mapList.shift());
    }
  }

  _deferRun(result, Container) {
    while (this._queueCall.length) {
      let current = this._queueCall.shift();
      try {
        if (result instanceof Success || result instanceof Fail) {
          result = current(result);
        } else {
          result = current(Container.of(result));
        }
      } catch (e) {
        result = Fail.of(`${e.constructor && e.constructor.name}:${e.message}`);
      }
      if (result instanceof Task) {
        this._reMount(result, [
          ...result._queueCall,
          ...this._queueCall.slice(0)
        ]);
        this._queueCall = [];
      }
    }
  }

  resolve(result) {
    if (this._state != STATE.PENDING) return;
    defer(() => {
      this._deferRun(result, Success);
      this._state = STATE.FULFILLED;
    });
  }

  reject(result) {
    if (this._state != STATE.PENDING) return;
    defer(() => {
      this._deferRun(result, Fail);
      this._state = STATE.REJECTED;
    });
  }

  map(f) {
    this._queueCall.push(f);
    return this;
  }

  cancel() {
    if (this._state !== STATE.PENDING) return;
    this._queueCall = [];
    this._state = STATE.FULFILLED;
  }
}

export default Task;

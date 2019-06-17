import { compose, map } from './core';
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
    this._errorCall = null;
    this._value = null;
    this._retryCount = 0;
    this._retryInterval = 0;
    this._filterRetry = x => x;
    this._resolve = this._resolve.bind(this);
    this._reject = this._reject.bind(this);
    this._f = f;
    try {
      f.apply(this, [this._resolve, this._reject]);
    } catch (e) {
      this._reject(e);
    }
  }

  static of(f) {
    if (typeof f === 'function') {
      return new Task(f);
    }
    return Task.resolve(f);
  }

  static resolve(x) {
    return Task.of(resolve => resolve(x));
  }

  static reject(x) {
    return Task.of((resolve, reject) => reject(x));
  }

  value() {
    return this._value;
  }

  _removeQueue() {
    this._queueCall = [];
  }

  _reMount(target, mapList, errorCall) {
    target._removeQueue();
    while (mapList.length) {
      target.map(mapList.shift());
    }
    target._errorCall = errorCall;
  }

  _deferRun(result) {
    while (this._queueCall.length) {
      if (result instanceof Task) {
        // map 中 return new Task,将剩余未执行的map function 挂到新生成的Task
        this._reMount(
          result,
          [...result._queueCall, ...this._queueCall.slice(0)],
          this._errorCall
        );
        this._queueCall = [];
        this._errorCall = null;
        continue;
      }

      let current = this._queueCall.shift();
      try {
        if (result instanceof Fail) {
          if (this._errorCall) {
            result = Success.of(this._errorCall(result.value()));
            this._errorCall = null;
            continue;
          }
        }
        result = map(current, result); // return Success
        if (
          typeof result.value === 'function' &&
          result.value() instanceof Task
        ) {
          result = result.value();
        }
      } catch (e) {
        result = Fail.of(`${e.constructor && e.constructor.name}:${e.message}`);
      }
    }
    if (!this._queueCall.length && result instanceof Fail && this._errorCall) {
      this._errorCall(result.value());
      return;
    }
    this._value = result;
  }

  _resolve(result) {
    if (this._state != STATE.PENDING) return;
    defer(() => {
      this._deferRun(Success.of(result));
      this._state = STATE.FULFILLED;
    });
  }

  _reject(result) {
    if (this._state != STATE.PENDING) return;
    if (this._retryCount && this._retryInterval && this._filterRetry(result)) {
      defer(() => {
        this._f.apply(this, [this._resolve, this._reject]);
      }, this._retryInterval);
      this._retryCount--;
      return;
    }
    defer(() => {
      this._deferRun(Fail.of(result));
      this._state = STATE.REJECTED;
    });
  }

  map(f) {
    this._queueCall.push(f);
    return this;
  }

  // f return another Task,this._value is a function
  chain(f) {
    return Task.of((resolve, reject) =>
      this.map(x =>
        f(x)
          .map(resolve)
          .error(reject)
      ).error(reject)
    );
  }

  ap(another) {
    return this.chain(fn => {
      if (typeof fn !== 'function') {
        console.warn(`call ap(),${fn} is not a function`);
      }
      if (another._state !== STATE.PENDING) {
        //这个task先于其他任务完成
        return another._value // Success or Fail
          .map(fn);
      }
      return another.map(fn);
    });
  }

  error(f) {
    this._errorCall = f;
    return this;
  }

  retry(count, interval) {
    this._retryCount = count;
    this._retryInterval = interval;
    return this;
  }

  filterRetry(f) {
    this._filterRetry = f;
    return this;
  }

  cancel() {
    if (this._state !== STATE.PENDING) return;
    this._queueCall = [];
    this._state = STATE.FULFILLED;
  }
}

export default Task;

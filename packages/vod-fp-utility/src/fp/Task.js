import { compose, map, trace } from './core';
import { Fail, Success } from './Either';
import { defer } from './_inner/defer';
import CusError from './CusError';

const STATUS = {
  PENDING: 0,
  FULLFILLED: 1,
  REJECTED: 2,
};

const NOOP = () => {};

export default class Task {
  constructor(execute) {
    this._status = STATUS.PENDING;
    this._onSuccess = NOOP;
    this._onFail = NOOP;
    this._nextResolve = NOOP;
    this._nextReject = NOOP;
    this._retryCount = 0;
    this._retryInterval = 0;
    this._filterRetry = (x) => x;
    this._value = undefined;
    this._execute = execute;
    execute.bind(
      null,
      this._deferResolve.bind(this),
      this._deferReject.bind(this)
    )();
  }

  static resolve(arg) {
    return new Task((resolve) => {
      resolve(arg);
    });
  }

  static reject(arg) {
    return new Task((_, reject) => {
      reject(arg);
    });
  }

  static of(f) {
    if (typeof f === 'function') {
      return new Task(f);
    }
    return Task.resolve(f);
  }

  _deferResolve(data) {
    setTimeout(() => {
      this._onResolve(data);
    });
  }

  _deferReject(data) {
    setTimeout(() => {
      this._onReject(data);
    });
  }

  _onResolve(data) {
    if (this._status !== STATUS.PENDING) return;

    this._status = STATUS.FULLFILLED;
    this._value = Success.of(data);

    if (this._onSuccess === NOOP) return;

    try {
      let ret = this._onSuccess(data);
      if (ret instanceof Task) {
        ret.map(this._nextResolve).error(this._nextReject);
      } else {
        this._nextResolve(ret);
      }
    } catch (e) {
      this._nextReject(e);
    }
  }

  _onReject(data) {
    if (this._status !== STATUS.PENDING) return;

    if (this._retryCount && this._retryInterval && this._filterRetry(data)) {
      setTimeout(() => {
        this._execute.apply(this, [this._resolve, this._reject]);
      }, this._retryInterval);

      this._retryCount--;
      return;
    }

    this._status = STATUS.REJECTED;
    this._value = Fail.of(data);

    if (this._onFail === NOOP) {
      this._nextReject(data);
      return;
    }

    try {
      let ret = this._onFail(data);
      if (ret instanceof Task) {
        ret.map(this._nextResolve).error(this._nextReject);
      } else {
        this._nextResolve(ret);
      }
    } catch (e) {
      this._nextReject(e);
    }
  }

  map(successFn) {
    this._onSuccess = successFn;
    return new Task((resolve, reject) => {
      this._nextResolve = resolve;
      this._nextReject = reject;
    });
  }

  error(failFn) {
    this._onFail = failFn;
    let ret = new Task((resolve, reject) => {
      this._nextResolve = resolve;
      this._nextReject = reject;
      return this;
    });
    return ret;
  }

  chain(fn) {
    return Task.of((resolve, reject) =>
      this.map((x) => {
        fn(x).map(resolve).error(reject);
      }).error(reject)
    );
  }

  ap(another) {
    return this.chain((fn) => {
      if (typeof fn !== 'function') {
        console.warn(`call ap(),${fn} is not a function`);
      }
      if (another._status !== STATUS.PENDING) {
        //这个task先于其他任务完成
        return another._value // Success or Fail
          .map(fn);
      }
      return another.map(fn);
    });
  }

  getOrElse() {
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
    this._status = STATUS.FULFILLED;
  }
}

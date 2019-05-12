import Base from './Base';
import { curry } from './core';
class Either extends Base {}

class Fail extends Either {
  static of(value) {
    return new Fail(value);
  }
  map() {
    return this;
  }
}

class Success extends Either {
  static of(value) {
    return new Success(value);
  }
  map(f) {
    return Success.of(f(this._value));
  }
}

const either = curry((fn1, fn2, e) => {
  if (e && e.constructor === Fail) {
    return fn1(e.value());
  }
  if (e && e.constructor === Success) {
    return fn2(e.value());
  }
  throw new Error('params not a Either');
});

export { Fail, Success, either };

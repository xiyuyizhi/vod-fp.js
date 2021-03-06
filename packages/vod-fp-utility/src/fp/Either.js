import Base from './Base';
import { curry } from './core';
import { Just, Empty } from './Maybe';
import CusError from './CusError';
class Either extends Base { }

class Fail extends Either {
  static of(value) {
    return new Fail(value);
  }
  map() {
    return this;
  }
  join() {
    return this;
  }
  chain() {
    return this;
  }
  ap() {
    return this;
  }
  // 用于 Task中_value为 Fail时
  error(f) {
    return Fail.of(f(this.value()));
  }
}

class Success extends Either {
  static of(value) {
    return new Success(value);
  }
  map(f) {
    try {
      return Success.of(f(this.value()));
    } catch (e) {
      return Fail.of(CusError.of(e));
    }
  }
  join() {
    return this.value();
  }
  chain(f) {
    return this.map(f).join();
  }
  ap(another) {
    return another.map(this.value());
  }
  error() {
    return this;
  }
}

const either = curry((fn1, fn2, e) => {
  if (e && e.constructor === Fail) {
    return fn1(e.value());
  }
  if (e && e.constructor === Success) {
    return fn2(e.value());
  }
});

const eitherToMaybe = either => {
  if (either.constructor === Success) {
    return Just.of(either.value());
  }
  return Empty.of();
};

export { Fail, Success, either, eitherToMaybe };

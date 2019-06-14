import Base from './Base';
import { curry } from "./core"
import { Success } from "./Either"
class Maybe extends Base {
  static of(value) {
    if (value === undefined || value === null) {
      return Empty.of();
    }
    return Just.of(value);
  }
}

class Empty extends Maybe {
  static of(value) {
    return new Empty(value);
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
  value() {
    return this._value || this.toString();
  }
  getOrElse(f) {
    if (typeof f === 'function') {
      return f();
    }
    return f;
  }
  toString() {
    return 'Empty';
  }
}

class Just extends Maybe {
  static of(value) {
    return new Just(value);
  }

  map(fn) {
    const v = fn(this._value);
    return Maybe.of(v);
  }

  join() {
    return this.value();
  }

  chain(f) {
    return this.map(f).join();
  }

  ap(f) {
    return f.map(this.value());
  }

  getOrElse(f) {
    let v = this.value();
    if (typeof f === 'function' && v && v.constructor === Empty) {
      return f(v.value());
    }
    return this.value();
  }
}

const maybeToEither = (maybe) => maybe.chain(x => Success.of(x))

const maybe = curry((f1, f2, e) => {
  if (e && e.constructor === Empty) {
    return f1(e.value());
  }
  if (e && e.constructor === Just) {
    return f2(e.value());
  }
})

export { Empty, Just, Maybe, maybe, maybeToEither };

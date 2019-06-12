import Base from './Base';
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
    return this.toString();
  }
  getOrElse(value) {
    if (typeof value === 'function') {
      return value();
    }
    return value;
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

  getOrElse() {
    return this.value();
  }
}

const maybeToEither = (maybe) => maybe.chain(x => Success.of(x))


export { Empty, Just, Maybe, maybeToEither };

import Base from './Base';

class Maybe extends Base {

  static of(value) {
    if (value === undefined || value === null) {
      return Empty.of()
    }
    return Just.of(value)
  }

}

class Empty extends Maybe {
  static of(value) {
    return new Empty(value)
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
    return this.toString()
  }
  toString() {
    return 'Empty'
  }

}

class Just extends Maybe {

  static of(value) {
    return new Just(value)
  }

  map(fn) {
    const v = fn(this._value);
    return Maybe.of(v);
  }

  join() {
    return this.value();
  }

  chain(f) {
    return this
      .map(f)
      .join()
  }

  ap(f) {
    return f.map(this.value());
  }

}

export {Empty, Just, Maybe}

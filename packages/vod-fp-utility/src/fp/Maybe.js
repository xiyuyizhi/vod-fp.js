import Base from './Base';

export default class Maybe extends Base {
  static of(value) {
    return new Maybe(value);
  }

  get isEmpty() {
    return this._value === undefined || this._value === null;
  }

  map(fn) {
    return this.isEmpty
      ? this
      : Maybe.of(fn(this._value));
  }

  join() {
    return this.isEmpty
      ? Maybe.of(null)
      : this.value();
  }

  chain(f) {
    return this
      .map(f)
      .join()
  }

  toString() {
    return this.isEmpty
      ? 'Empty'
      : super.toString();
  }
}

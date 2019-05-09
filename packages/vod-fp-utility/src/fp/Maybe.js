import Base from './Base';

export default class Maybe extends Base {
  static of(value) {
    return new Maybe(value);
  }

  get isEmpty() {
    return this._value === undefined || this._value === null;
  }

  map(fn) {
    return this.isEmpty ? this : Maybe.of(fn(this._value));
  }

  toString() {
    return this.isEmpty ? 'Empty' : super.toString();
  }
}

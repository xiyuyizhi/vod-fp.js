import { type } from 'os';

export default class Base {
  constructor(value) {
    this._value = value;
  }

  static of(value) {
    return new Base(value);
  }

  value() {
    return this._value;
  }

  map(f) {
    return Base.of(f(this._value));
  }

  ap(another) {
    return another.map(this.value())
  }

  toString() {
    const clsName = this.constructor.name;
    if (this._value instanceof this.constructor) {
      return `${clsName}(` + `${this._value.toString()}` + `)`;
    }
    return `${clsName}(${JSON.stringify(this._value)})`;
  }
  valueOf() {
    return this.toString();
  }
}

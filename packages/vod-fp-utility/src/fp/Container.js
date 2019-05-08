import { type } from 'os';

export default class Container {
  constructor(value) {
    this.$value = value;
  }

  static of(value) {
    return new Container(value);
  }

  value() {
    return this.$value;
  }

  map(f) {
    return Container.of(f(this.$value));
  }

  toString() {
    const clsName = this.constructor.name;
    if (this.$value instanceof this.constructor) {
      return `${clsName}(` + `${this.$value.toString()}` + `)`;
    }
    return `${clsName}(${JSON.stringify(this.$value)})`;
  }
  valueOf() {
    return this.toString();
  }
}

import Container from './Container';

export default class Maybe extends Container {
  constructor(value) {
    super(value);
  }

  static of(value) {
    return new Maybe(value);
  }

  get isEmpty() {
    return this.$value === undefined || this.$value === null;
  }

  map(fn) {
    return this.isEmpty ? this : Maybe.of(fn(this.$value));
  }

  toString() {
    return this.isEmpty ? 'Empty' : super.toString();
  }
}

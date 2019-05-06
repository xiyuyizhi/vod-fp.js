import Container from './Container';

export default class Either extends Container {
  constructor(value) {
    super(value);
  }

  static of(value) {
    return new Maybe(value);
  }
}

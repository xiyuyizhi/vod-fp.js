import Container from './Container';
import { compose } from '../core';
class IO extends Container {
  static of(fn) {
    return new IO(fn);
  }

  map(f) {
    return IO.of(
      compose(
        f,
        this.$value
      )
    );
  }
}

export default IO;

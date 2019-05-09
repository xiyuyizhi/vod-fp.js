import Base from './Base';
import { compose } from '../core';
class IO extends Base {
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

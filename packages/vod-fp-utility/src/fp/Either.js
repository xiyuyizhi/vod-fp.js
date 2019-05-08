import Container from './Container';

class Either extends Container {}

class Fail extends Either {
  static of(value) {
    return new Fail(value);
  }
  map() {
    return this;
  }
}

class Success extends Either {
  static of(value) {
    return new Success(value);
  }
  map(f) {
    return Success.of(f(this.$value));
  }
}

function either(fn1, fn2, e) {
  if (e.constructor === Fail) {
    return fn1(e.value());
  }
  if (e.constructor === Success) {
    return fn2(e.value());
  }
  throw new Error('params not contain a instance of Either');
}

export { Fail, Success, either };

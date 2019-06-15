export default class Tick {
  constructor(f) {
    this._value = f;
    this._duration = 150;
    this._timer = -1;
  }

  static of(f) {
    return new Tick(f);
  }

  interval(time) {
    this._duration = time;
    return this;
  }

  immediate() {
    clearTimeout(this._timer);
    this.run();
    this._value();
    return this;
  }

  run() {
    this._timer = setTimeout(() => {
      this.immediate();
    }, this._duration);
    return this;
  }
  stop() {
    clearTimeout(this._timer);
    return this;
  }
}

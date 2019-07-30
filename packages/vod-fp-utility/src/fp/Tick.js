export default class Tick {
  constructor() {
    this._tickInterval = 150;
    this._timer = null;
    this._tasks = [];
  }

  static of() {
    return new Tick();
  }

  addTask(f, needTick) {
    if (!this._tasks.filter(t => t.task === f).length) {
      this._tasks.push({
        ts: performance.now(),
        task: f
      });
    }
    return this;
  }

  interval(time) {
    this._interval = time;
    this._tickInterval = time * 0.5;
    this._initTimer();
    return this;
  }

  _initTimer() {
    this._timer = setInterval(this._run.bind(this), this._tickInterval);
  }

  immediateRun() {
    this._run(true);
    return this;
  }

  _run(immediately, nextTick) {
    let _tasks;

    if (nextTick) {
      _tasks = this._tasks.filter(t => t.nextTick);
    } else {
      _tasks = this._tasks.filter(
        t =>
          immediately ||
          (!t.nextTick && performance.now() - t.ts >= this._interval)
      );
    }
    _tasks.forEach(t => {
      t.ts = performance.now();
      t.task(duration => {
        if (duration) {
          t.nextTick = false;
          t.ts = performance.now() + (duration - this._interval);
          this._run();
        } else {
          t.nextTick = true;
          this._run(false, true);
        }
      });
    });
  }

  _clean() {
    clearInterval(this._timer);
  }

  stop() {
    this._clean();
  }

  destroy() {
    this._clean();
    this._tasks = [];
  }

  resume() {
    this._clean();
    this.immediateRun();
    this._tasks.forEach(t => {
      t.needTick = false;
      t.ts = performance.now();
    });
    this._initTimer();
  }
}

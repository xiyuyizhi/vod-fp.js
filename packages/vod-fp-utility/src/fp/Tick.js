export default class Tick {
  constructor() {
    this._tickInterval = 100;
    this._timer = null;
    this._tasks = [];
  }

  static of() {
    return new Tick();
  }

  addTask(f, needTick) {
    if (!this._tasks.filter(t => t.task === f).length) {
      this._tasks.push({
        needTick,
        ts: performance.now(),
        task: f
      })
    }
    return this;
  }

  interval(time) {
    this._interval = time;
    this._tickInterval = time * 0.8
    this._initTimer();
    return this;
  }

  _initTimer() {
    this._timer = setInterval(this._run.bind(this), this._tickInterval)
  }

  immediateRun() {
    this._run(true);
    return this;
  }

  _run(immediately, needTick) {
    let _tasks;
    if (!immediately && needTick) {
      console.error('needTick模式必须和immediately结合使用')
    }
    if (needTick) {
      _tasks = this._tasks.filter(t => t.needTick)
    } else {
      _tasks = this._tasks.filter(t => (immediately) || (!t.needTick && performance.now() - t.ts >= this._interval))
    }

    _tasks.forEach(t => {
      t.ts = performance.now();
      t.task((duration) => {
        if (duration) {
          t.needTick = false;
          t.ts = performance.now() + (duration - this._interval);
          this._run();
        } else {
          t.needTick = true
          this._run(true, true)
        }
      })
    })
  }

  _clean() {
    clearInterval(this._timer)
  }

  stop() {
    this._clean()
  }

  resume() {
    this._clean()
    this.immediateRun();
    this._tasks.forEach(t => {
      t.needTick = false;
      t.ts = performance.now();
    })
    this._initTimer()
  }

}

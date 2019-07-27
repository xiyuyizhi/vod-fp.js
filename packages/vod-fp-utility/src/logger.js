class Logger {
  constructor(module) {
    this._module = module;
    this.setUp();
    let debug;
    try {
      debug = document.cookie
        .split(';')
        .map(x => x.replace(/\s+/, ''))
        .filter(x => x.indexOf('debug') !== -1)[0];
    } catch (e) {
      debug = false;
    }

    if (debug) {
      try {
        Logger.usedModules = debug.split('=')[1].split(',');
      } catch {}
    }
  }

  static use(modules) {
    Logger.usedModules = Logger.usedModules.concat(modules);
  }

  get disabled() {
    if (!Logger.usedModules.length) return true;
    return Logger.usedModules.indexOf(this._module) === -1;
  }

  setUp() {
    const keys = ['log', 'warn', 'error', 'group', 'groupEnd'];
    keys.forEach(key => {
      this[key] = (...args) => {
        if (this.disabled) return;
        console[key].apply(window.console, args);
      };
    });
  }
}

Logger.usedModules = [];

export default Logger;

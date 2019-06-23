class Logger {
  constructor(module) {
    this._module = module;
    this.setUp();
  }

  static use(modules) {
    Logger.usedModules = modules;
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

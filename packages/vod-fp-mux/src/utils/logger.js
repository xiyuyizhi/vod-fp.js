class Logger {

  constructor(position) {
    this._position = position
    this._disabled = false;
    this.setUp()
  }

  disabled() {
    this._disabled = true;
    return this;
  }

  setUp() {
    const keys = ['log', 'warn', 'error', 'group', 'groupEnd']
    keys.forEach(key => {
      this[key] = (...args) => {
        if (this._disabled) 
          return;
        let arg1 = args[0];
        if (arg1 && arg1.indexOf && arg1.indexOf('%c') !== -1) {
          arg1 = arg1.replace(/(\%c)/, `$1 [${this._position}]: `)
          args = [arg1].concat(args.slice(1))
        } else {
          args = [`${this._position}: `].concat(args)
        }
        console[key].apply(null, args)
      }
    })

  }
}

export default Logger;
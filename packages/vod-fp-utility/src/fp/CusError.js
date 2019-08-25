import Base from './Base';

Error.prototype.is = () => {};
Error.prototype.getOrElse = () => {};

export default class CusError {
  constructor(value) {
    if (value instanceof Error) {
      this._value = {
        fatal: true,
        type: value.constructor.name,
        message: value.message + ',' + value
          .stack
          .slice(0, 120),
        originType: value.constructor.name // 非自定义错误
      };
    } else {
      this._value = value;
    }
  }

  static of(value) {
    return new CusError(value);
  }

  getOrElse(e) {
    if (!this._value.originType) 
      return this;
    return this._merge(e);
  }

  merge(another) {
    return this._merge(another);
  }

  _merge(another) {
    return CusError.of({
      ...this._value,
      ...another._value
    });
  }

  fatal(flag) {
    if (flag) {
      this._value.fatal = flag;
    } else {
      return this._value.fatal;
    }
  }

  value() {
    return this._value;
  }

  join() {
    return this.value();
  }

  detail() {
    return this._value.detail;
  }

  type() {
    return this._value.type;
  }

  is(another) {
    return (this._value.type === another.type && this._value.detail === another.detail);
  }
  isType(another) {
    return this._value.type === another.type;
  }
}

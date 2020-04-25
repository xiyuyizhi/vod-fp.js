function getBoxType(buffer, start) {
  return [
    buffer[start],
    buffer[start + 1],
    buffer[start + 2],
    buffer[start + 3],
  ]
    .map((x) => String.fromCharCode(x))
    .join('');
}

class BytesForward {
  constructor(buffer, offset = 0) {
    this._offset = offset;
    this._buffer = buffer;
  }
  get offset() {
    return this._offset;
  }

  set offset(of) {
    this._offset = of;
  }

  forward(bytes) {
    this._offset += bytes;
  }

  subarray(length) {
    if (length) {
      return this._buffer.subarray(this._offset, this._offset + length);
    }
    return this._buffer.subarray(this._offset, length);
  }

  readBytes(count) {
    const { _offset, _buffer } = this;
    let arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(_buffer[_offset + i]);
    }
    return arr;
  }

  read8bitsValue() {
    return this._buffer[this._offset];
  }

  read16bitsValue() {
    const { _offset, _buffer } = this;
    return (_buffer[_offset] << 8) | _buffer[_offset + 1];
  }
  read24bitsValue() {
    const { _offset, _buffer } = this;
    return (
      (_buffer[_offset] << 16) |
      (_buffer[_offset + 1] << 8) |
      _buffer[_offset + 12]
    );
  }

  read32bitsValue() {
    const { _offset, _buffer } = this;
    return (
      _buffer[_offset] * (1 << 24) +
      _buffer[_offset + 1] * (1 << 16) +
      _buffer[_offset + 2] * (1 << 8) +
      _buffer[_offset + 3]
    );
  }

  read32bitsValueSigned() {
    const { _offset, _buffer } = this;
    return (
      (_buffer[_offset] << 24) |
      (_buffer[_offset + 1] << 16) |
      (_buffer[offset + 2] << 8) |
      _buffer[offset + 3]
    );
  }
}

export { BytesForward, getBoxType };

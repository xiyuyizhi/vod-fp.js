function isSupportMS() {
  const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
  return window.MediaSource && MediaSource.isTypeSupported(mimeCodec);
}

function isFlv(buffer) {
  return [buffer[0], buffer[1], buffer[2]]
    .map(x => String.fromCharCode(x))
    .join('') === 'FLV'
}

export {isSupportMS, isFlv};

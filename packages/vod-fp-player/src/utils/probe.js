function isSupportMS() {
  const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
  return window.MediaSource && MediaSource.isTypeSupported(mimeCodec);
}

export { isSupportMS };

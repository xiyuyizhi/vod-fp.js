export const checkCombine = tracks => {
  return tracks.videoId !== -1 && tracks.audioId !== -1;
};

export const geneVideoCodecStr = buffer => {
  let codecstring = 'avc1.';
  for (let i = 0; i < 3; i++) {
    let h = buffer[i].toString(16);
    if (h.length < 2) {
      h = '0' + h;
    }
    codecstring += h;
  }
  return codecstring;
}

export const geneAudioTrackConfig = (audioObjectType, samplerateIndex, channel) => {
  let userAgent = navigator
    .userAgent
    .toLowerCase();
  let extensionSamplingIndex = samplerateIndex;
  let config = new Array(2);

  if (samplerateIndex >= 6) {
    audioObjectType = 5;
    extensionSamplingIndex -= 3;
    config = new Array(4);
  }

  config[0] = audioObjectType << 3;
  config[0] |= (samplerateIndex & 0x0e) >> 1;
  config[1] |= (samplerateIndex & 0x01) << 7;
  config[1] |= channel << 3;
  if (audioObjectType === 5) {
    config[1] |= (extensionSamplingIndex & 0x0e) >> 1;
    config[2] = (extensionSamplingIndex & 0x01) << 7;
    // extended audio object type: force to 2 (LC-AAC)
    config[2] |= 2 << 2;
    config[3] = 0;
  }
  return {config, audioObjectType}
}
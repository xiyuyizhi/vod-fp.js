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
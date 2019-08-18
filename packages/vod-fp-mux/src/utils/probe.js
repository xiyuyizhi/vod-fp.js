function tsProbe(buffer) {
  const len = Math.min(1000, buffer.byteLength - 3 * 188);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0x47 && buffer[i + 188] === 0x47 && buffer[i + 188 * 2] === 0x47) {
      return i;
    }
  }
  return -1;
}
function flvProbe(buffer) {
  return [buffer[0], buffer[1], buffer[2]]
    .map(x => String.fromCharCode(x))
    .join('') === 'FLV'
}

export {tsProbe, flvProbe};

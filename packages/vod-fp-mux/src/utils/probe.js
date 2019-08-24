import {getBoxType} from "./BytesForward";

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

function mp4Probe(buffer) {
  let len = buffer.byteLength
  let v = new DataView(buffer.buffer, 0, len);
  let offset = 0;

  let hasMdat;
  let hasMoof;
  let hasMoov;

  while (offset < len) {
    let boxLen = v.getUint32(offset, false);
    let type = getBoxType(buffer, offset + 4);
    if (type === 'moov') {
      hasMoov = true
    }
    if (type === 'moof') {
      hasMoof = true;
    }
    if (type === 'mdat') {
      hasMdat = true;
    }
    offset += boxLen;
  }

  if (hasMoov && hasMdat && !hasMoof) 
    return 'mp4'
  if (hasMoov && !hasMdat) 
    return 'initMp4';
  if (hasMoof) 
    return 'fmp4';

  }

export {tsProbe, flvProbe, mp4Probe};

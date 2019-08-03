export function findMp4Box(structure, path) {
  let i = 0;
  let current = structure;
  for (let i = 0; i < path.length; i++) {
    current = (current.data || current).filter(x => x.type === path[i]);
    if (current) {
      current = current[0];
    }
  }
  return current;
}

export function geneAvcCodec(sps) {
  return (
    'avc1.' +
    [sps[1], sps[2], sps[3]].map(x => ('0' + x.toString(16)).slice(-2)).join('')
  );
}

export function geneMp4aCodec(codecConfigLength) {
  return 'mp4a.40.' + (codecConfigLength === 2 ? '2' : '5');
}

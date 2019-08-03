export const checkCombine = tracks => {
  return Object.keys(tracks).filter(x => tracks[x] !== -1).length == 2;
};

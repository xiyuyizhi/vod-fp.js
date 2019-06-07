import { F } from 'vod-fp-utility';

function tick({ id, getState }, a, b) {
  console.log(getState());
  console.log(id, a, b);
}

const startTick = F.curry(tick);

export { startTick };

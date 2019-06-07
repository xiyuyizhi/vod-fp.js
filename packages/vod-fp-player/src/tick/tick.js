import { F } from 'vod-fp-utility';

function tick({ id }, a, b) {
  console.log(id, a, b);
}

const startTick = F.curry(tick);

export { startTick };

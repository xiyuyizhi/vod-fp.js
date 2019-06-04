import { F } from 'vod-fp-utility';

function tick(a, b) {
  console.log(a, b);
}

const startTick = F.curry(tick);

export { startTick };

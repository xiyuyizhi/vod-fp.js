import { F } from 'vod-fp-utility';
import { connect, ACTION } from '../store';

function buffer({ id }, currentTime) {
  console.log('store是否正确?', id, currentTime);
}

buffer = connect(F.curry(buffer));

export { buffer };

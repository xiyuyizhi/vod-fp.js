import { F, Task } from 'vod-fp-utility';
import { connect, ACTION } from '../store';

function playlist(url) {}

function startLoad(url) {
  return Task.of(resolve => {
    // throw new Error('hhhhh');
    resolve(1);
  });
}

export { startLoad };

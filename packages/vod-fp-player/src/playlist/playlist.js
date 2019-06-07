import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from '../buffer/buffer';
import m3u8Parser from '../utils/m3u8-parser';

function startLoad({ id, dispatch, getState, connect }, url) {
  return Task.of((resolve, reject) => {
    // throw new Error('hhhhh');
    fetch(url)
      .then(res => res.text())
      .then(text => {
        connect(buffer)(1111);
        resolve(text);
      }, reject);
  }).map(text => {
    const level = m3u8Parser(text);
    dispatch(ACTION.PLAYLIST.PLAYLIST, {
      currentLevel: 1,
      levels: [level]
    });
    // dispatch(ACTION.PLAYLIST.CURRENT_LEVEL, 2);
    return level;
  });
}

export default F.curry(startLoad);

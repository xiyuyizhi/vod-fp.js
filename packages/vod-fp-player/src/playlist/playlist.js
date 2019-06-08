import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from '../buffer/buffer';
import m3u8Parser from '../utils/m3u8-parser';

function startLoad({ id, dispatch, subscribe, getState, connect }, url) {
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
    // subscribe(ACTION.PLAYLIST.CURRENT_LEVEL, state => console.log(state));
    dispatch(ACTION.PLAYLIST.PLAYLIST, {
      currentLevelId: 1,
      levels: [level]
    });
    // dispatch(ACTION.PLAYLIST.CURRENT_LEVEL_ID, 2);
    return level;
  });
}

export default F.curry(startLoad);

import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import m3u8Parser from '../utils/m3u8-parser';

function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  return Task.of((resolve, reject) => {
    // throw new Error('hhhhh');
    fetch(url)
      .then(res => res.text())
      .then(text => {
        resolve(text);
      }, reject);
  }).map(text => {
    const level = m3u8Parser(text);
    dispatch(ACTION.PLAYLIST.PLAYLIST, {
      currentLevelId: 1,
      levels: [level]
    });
    return level;
  });
}

export default F.curry(loadPlaylist);

import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import m3u8Parser from '../utils/m3u8-parser';

function getBasePath(url) {
  url = url.split('?');
  url = url[0];
  return url.slice(0, url.lastIndexOf('/') + 1);
}

function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  return Task.of((resolve, reject) => {
    // throw new Error('hhhhh');
    fetch(url)
      .then(res => {
        console.log(res);
        return res.text();
      })
      .then(text => {
        resolve(text);
      }, reject);
  }).map(text => {
    const level = m3u8Parser(text, getBasePath(url));
    dispatch(ACTION.PLAYLIST.LEVELS, [level]);
    return level;
  });
}

export default F.curry(loadPlaylist);

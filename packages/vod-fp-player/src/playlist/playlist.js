import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from "../loader/loader"

function getBasePath(url) {
  url = url.split('?');
  url = url[0];
  return url.slice(0, url.lastIndexOf('/') + 1);
}

function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  return loader({
    url
  }).map(text => {
    const level = m3u8Parser(text, getBasePath(url));
    dispatch(ACTION.PLAYLIST.LEVELS, [level]);
    return level;
  });
}

loadPlaylist = F.curry(loadPlaylist);

export {
  loadPlaylist
} 

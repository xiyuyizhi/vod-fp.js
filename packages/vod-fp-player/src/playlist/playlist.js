import { F, Task } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from '../loader/loader';

function getBasePath(url) {
  url = url.split('?');
  url = url[0];
  return url.slice(0, url.lastIndexOf('/') + 1);
}

// string -> Task
function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  return loader({
    url
  }).map(text => {
    return m3u8Parser(text, getBasePath(url))
      .map(playlist => {
        console.log(playlist);
        dispatch(
          ACTION.PLAYLIST.LEVELS,
          playlist.type === 'master' ? playlist.levels : [playlist]
        );
        return playlist;
      })
      .error(e => {
        dispatch(ACTION.ERROR, e);
        dispatch(ACTION.PROCESS, PROCESS.ERROR);
      });
  });
}

loadPlaylist = F.curry(loadPlaylist);

export { loadPlaylist };

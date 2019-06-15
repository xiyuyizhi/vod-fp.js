import { F, Task, Maybe, Empty, Just } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from '../loader/loader';

const { curry, compose, map, join, prop, head, trace, chain } = F;

function _getBasePath(url) {
  url = url.split('?');
  url = url[0];
  return url.slice(0, url.lastIndexOf('/') + 1);
}

// object --> Maybe
function _checkLevelOrMaster({ dispatch }, playlist) {
  if (playlist.type === 'level') {
    playlist = {
      levels: [
        {
          levelId: 1,
          detail: playlist,
          type: 'level'
        }
      ]
    };
    dispatch(ACTION.PLAYLIST.PL, playlist);
    return Empty.of();
  }
  dispatch(ACTION.PLAYLIST.PL, playlist);
  return Just.of(playlist);
}

// (Just,object) -> object
function _updateLevel({ dispatch }, level, levelDetail) {
  level.map(x => {
    dispatch(ACTION.PLAYLIST.UPDATE_LEVEL, {
      levelId: x.levelId,
      detail: levelDetail
    });
  });
  return levelDetail;
}

// Just --> Task   Empty --> Empty
function _handleMaster({ connect }, master) {
  let currentLevel = master.map(
    compose(
      head,
      prop('levels')
    )
  );
  // throw new Error('....');
  return compose(
    map(connect(_updateLevel)(currentLevel)),
    chain(_loadLevelOrMaster),
    map(prop('url'))
  )(currentLevel);
}

//  string --> Task
function _loadLevelOrMaster(url) {
  return loader({ url }).chain(x => m3u8Parser(x, _getBasePath(url)));
}

// string -> Task(Either)
function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  return Task.of((resolve, reject) => {
    _loadLevelOrMaster(url)
      .map(connect(_checkLevelOrMaster))
      .map(connect(_handleMaster))
      .map(playlist => {
        console.log('playlist', playlist);
        return playlist;
      })
      .map(resolve)
      .error(reject);
  });
}

_checkLevelOrMaster = curry(_checkLevelOrMaster);
_updateLevel = curry(_updateLevel);
_handleMaster = curry(_handleMaster);
loadPlaylist = F.curry(loadPlaylist);
export { loadPlaylist };

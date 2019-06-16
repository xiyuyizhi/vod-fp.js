import { F, Task, Maybe, Empty, Just, emptyToResolve } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from '../loader/loader';

const { curry, compose, map, join, prop, head, trace, identity, chain } = F;

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

// (Just,object) -> Just
function _updateLevel({ dispatch }, level, levelDetail) {
  level.map(x => {
    dispatch(ACTION.PLAYLIST.UPDATE_LEVEL, {
      levelId: x.levelId,
      detail: levelDetail
    });
  });
  return level;
}

function _updateMedia({ dispatch }, mediaDetail) {
  dispatch(ACTION.PLAYLIST.UPDATE_MEDIA, mediaDetail);
  return mediaDetail;
}

// Just --> Maybe
function _checkHasMatchedMedia({ getState }, level) {
  return chain(l => getState(ACTION.PLAYLIST.CURRENT_MEDIA, l.levelId))(level);
}

// Just --> Task   Empty --> Empty
function _updateLevelAndMedia({ connect }, master) {
  let currentLevel = master.map(
    compose(
      head,
      prop('levels')
    )
  );
  let matchedMedia = connect(_checkHasMatchedMedia)(currentLevel);
  // throw new Error('....');

  // Just --> Task  Empty --> Task
  let _loadMediaDetail = media => {
    return emptyToResolve(
      compose(
        map(connect(_updateMedia)),
        map(trace('log: load media detail,')),
        chain(_loadLevelOrMaster),
        map(prop('uri')),
        trace('log: find matched media: ')
      )(media)
    );
  };

  // Just --> Task  Empty --> Empty
  let _loadLevelDetail = level => {
    return compose(
      map(connect(_updateLevel)(level)),
      map(trace('log: load level detail,')),
      chain(_loadLevelOrMaster),
      map(prop('url')),
      trace('log: current Level,')
    )(level);
  };

  return currentLevel
    .map(() => {
      return Task.resolve(curry((level, mediaDetail) => level))
        .ap(_loadLevelDetail(currentLevel))
        .ap(_loadMediaDetail(matchedMedia));
    })
    .join();
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
      .map(connect(_updateLevelAndMedia))
      .map(resolve)
      .error(reject);
  });
}

_checkLevelOrMaster = curry(_checkLevelOrMaster);
_updateLevelAndMedia = curry(_updateLevelAndMedia);
_updateLevel = curry(_updateLevel);
_updateMedia = curry(_updateMedia);
_checkHasMatchedMedia = curry(_checkHasMatchedMedia);
loadPlaylist = F.curry(loadPlaylist);
export { loadPlaylist };

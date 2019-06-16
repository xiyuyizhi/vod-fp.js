import {
  F,
  Task,
  Maybe,
  Empty,
  Just,
  emptyToResolve,
  maybe
} from 'vod-fp-utility';
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

function _findLevelToLoad(master) {
  return master.map(
    compose(
      head,
      prop('levels')
    )
  );
}

// Just --> Task
function _updateLevelAndMedia({ connect }, level) {
  let matchedMedia = connect(_checkHasMatchedMedia)(level);

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

  // Just --> Task  Empty --> Task
  let _loadLevelDetail = l => {
    return emptyToResolve(
      compose(
        map(connect(_updateLevel)(l)),
        map(trace('log: load level detail,')),
        chain(_loadLevelOrMaster),
        map(prop('url')),
        trace('log: current Level,')
      )(l)
    );
  };
  return level
    .map(() => {
      return Task.resolve(curry((level, mediaDetail) => level))
        .ap(_loadLevelDetail(level))
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
      .map(_findLevelToLoad)
      .map(connect(_updateLevelAndMedia))
      .map(x => {
        dispatch(
          ACTION.EVENTS.MANIFEST_LOADED,
          getState(ACTION.PLAYLIST.PL).join()
        );
        return x;
      })
      .map(resolve)
      .error(reject);
  });
}

function changePlaylistLevel({ getState, connect, dispatch }, levelId) {
  let level = getState(ACTION.PLAYLIST.FIND_LEVEL, Number(levelId));
  maybe(
    () => {
      console.log(`start load level ${level.map(prop('levelId'))} detail`);
      connect(_updateLevelAndMedia)(level)
        .map(join)
        .map(level => {
          dispatch(ACTION.PLAYLIST.CURRENT_LEVEL_ID, level.levelId);
          dispatch(ACTION.EVENTS.LEVEL_CHANGED, Maybe.of(level.levelId));
        })
        .error(e => {
          console.log(e);
        });
    },
    () => {
      let levelId = level.map(prop('levelId'));
      dispatch(ACTION.PLAYLIST.CURRENT_LEVEL_ID, levelId.join());
      dispatch(ACTION.EVENTS.LEVEL_CHANGED, levelId);
    },
    map(prop('detail'), level)
  );
}

_checkLevelOrMaster = curry(_checkLevelOrMaster);
_updateLevelAndMedia = curry(_updateLevelAndMedia);
_updateLevel = curry(_updateLevel);
_updateMedia = curry(_updateMedia);
_checkHasMatchedMedia = curry(_checkHasMatchedMedia);
loadPlaylist = F.curry(loadPlaylist);
changePlaylistLevel = F.curry(changePlaylistLevel);
export { loadPlaylist, changePlaylistLevel };

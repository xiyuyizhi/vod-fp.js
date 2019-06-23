import {
  F,
  Logger,
  Task,
  Maybe,
  Empty,
  Just,
  Fail,
  emptyToResolve,
  maybe
} from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from '../loader/loader';
import { XHR_ERROR, PLAYLIST_ERROR, M3U8_PARSE_ERROR } from '../error';
import { CusError } from '../../../vod-fp-utility/src';

const {
  curry,
  compose,
  map,
  join,
  prop,
  head,
  trace,
  identity,
  chain,
  error
} = F;
let logger = new Logger('player');

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
        chain(connect(_loadLevelOrMaster)('MEDIA')),
        map(prop('uri')),
        trace('log: find matched media,')
      )(media)
    );
  };

  // Just --> Task  Empty --> Task
  let _loadLevelDetail = l => {
    return emptyToResolve(
      compose(
        map(connect(_updateLevel)(l)),
        map(trace('log: load level detail,')),
        chain(connect(_loadLevelOrMaster)('LEVEL')),
        map(prop('url')),
        trace('log: current Level,')
      )(l)
    );
  };
  return level.chain(() => {
    return Task.resolve(curry((level, mediaDetail) => level))
      .ap(_loadLevelDetail(level))
      .ap(_loadMediaDetail(matchedMedia));
  });
}

//  (string,type) --> Task  type:MANIFEST | LEVEL | MEDIA
function _loadLevelOrMaster({ connect, getConfig }, type, url) {
  let maxRetryCount = getConfig(ACTION.CONFIG.MAX_LEVEL_RETRY_COUNT);
  let toLoad = (retryCount, resolve, reject) => {
    connect(loader)({ url })
      .filterRetry(x => !x.is(XHR_ERROR.ABORT))
      .retry(
        getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
        getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
      )
      .chain(m3u8Parser(_getBasePath(url)))
      .map(resolve)
      .error(e => {
        let err = e;
        if (e.isType(XHR_ERROR) && !e.is(XHR_ERROR.ABORT)) {
          err = e.merge(CusError.of(PLAYLIST_ERROR[type][e.detail()]));
          //对于level和media,在重试几次
          if (retryCount && type !== 'MANIFEST') {
            retryCount--;
            logger.log('retry load..');
            toLoad(retryCount, resolve, reject);
            return;
          }
          err.fatal(true);
        }
        if (e.isType(M3U8_PARSE_ERROR)) {
          err = e.merge(CusError.of(PLAYLIST_ERROR[type][e.type()]));
        }
        reject(err);
      });
  };

  return Task.of((resolve, reject) => {
    toLoad(maxRetryCount, resolve, reject);
  });
}

// string -> Task(Either)
function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  dispatch(ACTION.PROCESS, PROCESS.PLAYLIST_LOADING);
  return Task.of((resolve, reject) => {
    connect(_loadLevelOrMaster)('MANIFEST', url)
      .map(connect(_checkLevelOrMaster))
      .map(_findLevelToLoad)
      .map(connect(_updateLevelAndMedia))
      .map(x => {
        dispatch(ACTION.PROCESS, PROCESS.PLAYLIST_LOADED);
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
      logger.log(`start load level ${level.map(prop('levelId'))} detail`);
      connect(_updateLevelAndMedia)(level)
        .map(join)
        .map(l => {
          dispatch(ACTION.PLAYLIST.CURRENT_LEVEL_ID, l.levelId);
          dispatch(ACTION.EVENTS.LEVEL_CHANGED, l.levelId);
        })
        .error(e => {
          dispatch(ACTION.EVENTS.LEVEL_CHANGED_ERROR, e.join());
        });
    },
    () => {
      let levelId = level.map(prop('levelId'));
      dispatch(ACTION.PLAYLIST.CURRENT_LEVEL_ID, levelId.join());
      dispatch(ACTION.EVENTS.LEVEL_CHANGED, levelId.join());
    },
    level.map(prop('detail'))
  );
}
_loadLevelOrMaster = curry(_loadLevelOrMaster);
_checkLevelOrMaster = curry(_checkLevelOrMaster);
_updateLevelAndMedia = curry(_updateLevelAndMedia);
_updateLevel = curry(_updateLevel);
_updateMedia = curry(_updateMedia);
_checkHasMatchedMedia = curry(_checkHasMatchedMedia);
loadPlaylist = F.curry(loadPlaylist);
changePlaylistLevel = F.curry(changePlaylistLevel);
export { loadPlaylist, changePlaylistLevel };

import {
  F,
  Logger,
  Task,
  Maybe,
  Empty,
  Just,
  Fail,
  emptyToResolve,
  maybe,
  CusError,
  Success,
  Tick
} from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import m3u8Parser from '../utils/m3u8-parser';
import loader from '../loader/loader';
import { mergePlaylist } from './m3u8-live';
import { getNextABRLoadLevel } from '../abr/abr';
import { LOADER_ERROR, PLAYLIST_ERROR, M3U8_PARSE_ERROR } from '../error';
import { loadInitMP4 } from './segment';
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

function _updateMedia({ dispatch }, level, mediaDetail) {
  level.map(l => {
    dispatch(ACTION.PLAYLIST.UPDATE_MEDIA, {
      levelId: l.levelId,
      detail: mediaDetail
    });
  });
  return mediaDetail;
}
function _updateKey({ dispatch }, levelId, key) {
  dispatch(ACTION.PLAYLIST.UPDATE_KEY, { levelId, key });
}

// Just --> Maybe
function _checkHasMatchedMedia({ getState }, level) {
  return chain(l => getState(ACTION.PLAYLIST.FIND_MEDIA, l.levelId))(level);
}

// Maybe --> Maybe , select the default level to load
function _findLevelToLoad(pl) {
  return pl.map(
    compose(
      head,
      prop('levels')
    )
  );
}

// Just --> Task
function _updateLevelAndMediaAndKey({ connect }, level) {
  let matchedMedia = connect(_checkHasMatchedMedia)(level);

  // Just --> Task  Empty --> Task
  let _loadMediaDetail = media => {
    return emptyToResolve(
      compose(
        map(connect(_updateMedia)(level)),
        map(trace('log: load media detail,')),
        chain(connect(loadResource)('MEDIA')),
        map(prop('uri')),
        trace('log: find matched media,')
      )(media)
    );
  };

  // Just --> Task  Empty --> Task
  let _loadLevelDetail = l => {
    return emptyToResolve(
      compose(
        map(connect(_checkloadDecryptKey)),
        map(connect(_updateLevel)(l)),
        map(trace('log: load level detail,')),
        chain(connect(loadResource)('LEVEL')),
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

// Just -> Task
function _checkloadDecryptKey({ getState, connect }, level) {
  return Task.of((resolve, reject) => {
    emptyToResolve(
      compose(
        map(connect(_updateKey)(level.join().levelId)),
        map(trace('log: load key detail,')),
        chain(connect(loadResource)('KEY')),
        map(prop('uri')),
        trace('log: find matched key info,'),
        map(prop('key')),
        map(prop('detail'))
      )(level)
    )
      .map(() => {
        resolve(level);
      })
      .error(reject);
  });
}

//  (string,type) --> Task  type:MANIFEST | LEVEL | MEDIA |KEY
function loadResource({ connect, getConfig }, type, url) {
  let maxRetryCount = getConfig(ACTION.CONFIG.MAX_LEVEL_RETRY_COUNT);
  let toLoad = (retryCount, resolve, reject) => {
    let params = type === 'KEY' ? { responseType: 'arraybuffer' } : null;
    connect(loader)({ url, params })
      .filterRetry(x => !x.is(LOADER_ERROR.ABORT))
      .retry(
        getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
        getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
      )
      .chain(type === 'KEY' ? Success.of : m3u8Parser(url))
      .map(resolve)
      .error(e => {
        let err = e;
        if (e.isType(LOADER_ERROR) && !e.is(LOADER_ERROR.ABORT)) {
          err = e.merge(CusError.of(PLAYLIST_ERROR[type][e.detail()]));
          //for level and media,retry
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

// object --> Task
function _checkLevelOrMaster({ dispatch, connect }, playlist) {
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
    return compose(
      connect(_checkloadDecryptKey),
      _findLevelToLoad,
      Maybe.of
    )(playlist);
  }
  dispatch(ACTION.PLAYLIST.PL, playlist);
  return compose(
    connect(_updateLevelAndMediaAndKey),
    _findLevelToLoad,
    Maybe.of
  )(playlist);
}

// string -> Task(Either)
function loadPlaylist({ id, dispatch, subscribe, getState, connect }, url) {
  dispatch(ACTION.PROCESS, PROCESS.PLAYLIST_LOADING);
  return Task.of((resolve, reject) => {
    connect(loadResource)('MANIFEST', url)
      .map(connect(_checkLevelOrMaster))
      .map(x => {
        dispatch(ACTION.PROCESS, PROCESS.IDLE);
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

// change playlist level from the outside call
function changePlaylistLevel({ getState, connect, dispatch }, levelId) {
  let level = getState(ACTION.PLAYLIST.FIND_LEVEL, Number(levelId));
  maybe(
    () => {
      logger.log(`start load level ${level.map(prop('levelId'))} detail`);
      connect(_updateLevelAndMediaAndKey)(level)
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

function _mergePlaylistWithLastLevel({ getState }, currenLevelId, lastLevelId) {
  let currenLevel = getState(ACTION.PLAYLIST.FIND_LEVEL, currenLevelId);
  let lastLevel = getState(ACTION.PLAYLIST.FIND_LEVEL, lastLevelId);

  Maybe.of(
    curry((currentDetail, lastDetail, media) => {
      logger.log(
        `the first time load the level ${currenLevelId}, need sync segment bound with last level ${lastLevelId}, [${currentDetail.startSN} , ${currentDetail.endSN}] , [${lastDetail.startSN} , ${lastDetail.endSN}]`
      );
      let segs = currentDetail.segments;
      let lastSegs = lastDetail.segments;
      let last;
      for (let i = 0; i < segs.length; i++) {
        let seg = segs[i];
        let lastSeg = lastSegs.find(x => x.id === seg.id);
        if (lastSeg) {
          seg.start = lastSeg.start;
          seg.end = seg.start + seg.duration;
          last = seg;
        } else if (last) {
          seg.start = last.end;
          seg.end = seg.start + seg.duration;
          last = seg;
        } else {
          seg.start = media.duration;
          seg.end = seg.start + seg.duration;
          last = seg;
        }
      }
    })
  )
    .ap(currenLevel.map(prop('detail')))
    .ap(lastLevel.map(prop('detail')))
    .ap(getState(ACTION.MEDIA.MEDIA_ELE));
}

// use in abr condition,when level changed
// we need to load the new level detail first
function inSureNextLoadLevelReady({ connect, dispatch, getState, subOnce }) {
  return Task.of(resolve => {
    Maybe.of(
      curry((currenLevel, nextAutoLevel) => {
        logger.warn(`level ${currenLevel} switch to ${nextAutoLevel}`);
        if (currenLevel == nextAutoLevel) {
          resolve();
          return;
        }
        // check the nextAutoLevel if already load
        let nextLevelHasDetail = getState(
          ACTION.PLAYLIST.FIND_LEVEL,
          nextAutoLevel
        ).map(prop('detail'));

        subOnce(ACTION.EVENTS.LEVEL_CHANGED, () => {
          Maybe.of(
            curry((_, levelUrl) => {
              // the first time load the nextAutoLevel or just update details
              nextLevelHasDetail
                .map(() => {
                  // fetch the newest details
                  connect(loadResource)('LEVEL', levelUrl).map(detail => {
                    logger.log('sync level detail when level changed in live');
                    connect(mergePlaylist)(nextAutoLevel, detail);
                  });
                  return true;
                })
                .getOrElse(() => {
                  connect(mergePlaylistWithLastLevel)(
                    nextAutoLevel,
                    currenLevel
                  );
                });
            })
          )
            .ap(getState(ACTION.PLAYLIST.IS_LIVE))
            .ap(getState(ACTION.PLAYLIST.GET_LEVEL_URL));

          if (getState(ACTION.PLAYLIST.FORMAT) === 'fmp4') {
            // load init.mp4 first
            subOnce(PROCESS.INIT_MP4_LOADED, () => {
              dispatch(ACTION.PLAYLIST.LAST_LEVEL_ID, currenLevel);
              dispatch(ACTION.PROCESS, PROCESS.IDLE);
              resolve();
            });
            connect(loadInitMP4)(nextAutoLevel, false);
            return;
          }
          dispatch(ACTION.PLAYLIST.LAST_LEVEL_ID, currenLevel);
          resolve();
        });

        connect(changePlaylistLevel)(nextAutoLevel);
      })
    )
      .ap(getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID))
      .ap(connect(getNextABRLoadLevel))
      .getOrElse(resolve);
  });
}

_checkloadDecryptKey = curry(_checkloadDecryptKey);
_checkLevelOrMaster = curry(_checkLevelOrMaster);
loadResource = curry(loadResource);
_updateLevelAndMediaAndKey = curry(_updateLevelAndMediaAndKey);
_updateLevel = curry(_updateLevel);
_updateMedia = curry(_updateMedia);
_updateKey = curry(_updateKey);
_checkHasMatchedMedia = curry(_checkHasMatchedMedia);
_mergePlaylistWithLastLevel = curry(_mergePlaylistWithLastLevel);
loadPlaylist = curry(loadPlaylist);
changePlaylistLevel = curry(changePlaylistLevel);
inSureNextLoadLevelReady = curry(inSureNextLoadLevelReady);

export {
  loadResource,
  loadPlaylist,
  changePlaylistLevel,
  inSureNextLoadLevelReady
};

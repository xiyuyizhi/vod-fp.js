import { F, Logger, Task, Maybe, Tick } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { _loadResource } from './playlist';
import { updateMediaDuration } from '../media/media';

const { curry, prop } = F;
let logger = new Logger('player');

function _traverseLevelsFindSNMatched(getState, sn) {
  return getState(ACTION.PLAYLIST.LEVELS).map(levels => {
    for (let level of levels) {
      let matched =
        level.detail && level.detail.segments.find(x => x.id === sn);
      if (matched) {
        return matched;
      }
    }
  });
}

// [0,1,1] -> [0,1,0]
// [0,1,1,2,2,2,3] -> [0,1,0,2,0,0,3]
// [1,1,1,2,2] -> [1,0,0,2,0]
function _convertCC(segments) {
  if (!segments || !segments.length) return segments;
  let newCC = segments[0].cc;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].cc !== newCC) {
      newCC = segments[i].cc;
    } else {
      segments[i].cc = 0;
    }
  }
  return segments;
}

// live merge playlist
// conditions:
//  1. current details sn [3,5], new details sn [2,4]
//     current details sn [3,5], new details sn [3,5]
//     current details sn [3,5], new details sn [4,6]
//     current details sn [3,5], new details sn [7,9]
//  2. last level 2,details sn [10,13]
//     level changed to 3
//     level 3 detaisl sn [3,6],flushed new details [9,12]、[10,13]、[11,14]
/**
 * 
 * @param {*} param0 
 * @param {*} levelId the current used level
 * @param {*} newDetails 
 */
function _mergePlaylist({ getState, dispatch, connect }, levelId, newDetails) {
  let noNews = false;

  getState(ACTION.PLAYLIST.FIND_LEVEL, levelId).map(level => {
    let { detail } = level;
    let oldStartSN = detail.startSN;
    let oldEndSN = detail.endSN;
    let oldSegments = detail.segments;
    let segments = _convertCC(newDetails.segments);
    let { startSN, endSN } = newDetails;
    let delta = startSN - oldStartSN;
    let lastSegment;
    let lastCC;
    logger.log(
      `merge level details with levelId ${levelId},[${oldStartSN},${oldEndSN}] -> [${startSN},${endSN}]`
    );
    noNews = oldStartSN === startSN && oldEndSN === endSN;

    let newStartSN = startSN;
    for (let i = 0; i <= endSN - startSN; i++) {

      if (oldSegments[i + delta]) {
        lastSegment = oldSegments[i + delta];
      } else {
        let newSeg = segments[i];
        if (!lastSegment) {
          lastSegment = _traverseLevelsFindSNMatched(
            getState,
            startSN + i
          ).value();
          if (lastSegment) {
            newSeg.start = lastSegment.start;
          } else {
            let lastLevelStartSN = getState(ACTION.PLAYLIST.FIND_LAST_LEVEL)
              .map(prop('detail'))
              .map(prop('startSN'))
              .getOrElse(startSN);
            let deltaCompareLastLevel = startSN - lastLevelStartSN;
            if (
              deltaCompareLastLevel < 0 &&
              deltaCompareLastLevel > -2 &&
              i != endSN - startSN
            ) {
              logger.warn(
                `can‘t find a matched segment for ${startSN +
                i}, startSN < lastLevel.startSN,continue loop`
              );
              newStartSN = startSN + i + 1;
              continue;
            }
            logger.warn(
              `can‘t find a matched segment for ${startSN +
              i},use total duration as sync start`
            );
            newSeg.start = detail.duration;
            lastSegment = oldSegments[oldSegments.length - 1];
          }
        } else {
          newSeg.start = lastSegment.end;
        }
        if (!lastCC) {
          lastCC = lastSegment.cc;
        }
        if (newSeg.cc) {
          // convertCC 转换后,0 表示和前一个分片cc相同、 !0 为新cc
          lastCC++;
        }
        // update segement key props
        newSeg.end = newSeg.start + newSeg.duration;
        //resolve discontinuity
        newSeg.cc = lastCC;
        newSeg.levelId = levelId;
        oldSegments.push(newSeg);
        lastSegment = newSeg;
      }
    }

    oldSegments = oldSegments.filter(x => x.id >= startSN);
    let first = oldSegments[0];
    let last = oldSegments[oldSegments.length - 1];
    detail.segments = oldSegments;
    detail.startSN = first.id;
    detail.endSN = last.id;
    detail.mediaSequence = detail.startSN;
    detail.live = detail.live;
    detail.duration = Math.max(detail.duration, last.end);
    dispatch(ACTION.PLAYLIST.UPDATE_LEVEL, {
      levelId,
      detail
    });
    dispatch(ACTION.CONFIG.MAX_BUFFER_LENGTH, newDetails.duration);
    dispatch(ACTION.CONFIG.MAX_FLY_BUFFER_LENGTH, newDetails.duration);
    connect(updateMediaDuration);
    logger.log(
      `slide position:${first.start} , `,
      `segments rangs: [${first.start},${last.end}]`
    );
  });
  return noNews;
}



function bootStrapFlushPlaylist({ getState, getConfig, connect }) {
  let interval = getState(ACTION.PLAYLIST.AVG_SEG_DURATION)
    .map(duration => {
      return (
        duration * getConfig(ACTION.CONFIG.LIVE_FLUSH_INTERVAL_FACTOR) * 1000
      );
    })
    .join();

  function _flushPlaylist(nextTick) {
    Maybe.of(
      curry((levelUrl, currentLevelId, isLive) => {
        let tsStart = performance.now();
        connect(_loadResource)('LEVEL', levelUrl)
          .map(details => {
            let noNews = connect(_mergePlaylist)(currentLevelId, details);
            if (isLive) {
              let time = interval - performance.now() + tsStart;
              time = time / (noNews ? 2 : 1);
              logger.log(`m3u8  flush after ${time} ms`);
              nextTick(time);
            }
          })
          .error(e => {
            console.log(e);
          });
      })
    )
      .ap(getState(ACTION.PLAYLIST.GET_LEVEL_URL))
      .ap(getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID))
      .ap(getState(ACTION.PLAYLIST.IS_LIVE));
  }

  Tick.of()
    .addTask(_flushPlaylist)
    .interval(interval)
    .immediateRun();
}

function _caclLiveSyncPosition({ getState, getConfig }) {
  return Maybe.of(
    curry((segs, duration) => {
      let segsTotalDuration = segs.map(prop('duration')).reduce((all, c) => {
        all += c;
        return all;
      }, 0);
      return (
        duration -
        segsTotalDuration * getConfig(ACTION.CONFIG.LIVE_LATENCY_FACTOR)
      );
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.PLAYLIST.DURATION));
}

function checkSyncLivePosition({ getState, connect }, media, bufferEnd) {
  Maybe.of(
    curry((live, slidePosition) => {
      //check the current play time is break away from the live point
      if (bufferEnd < slidePosition) {
        logger.log(
          'bufferEnd:',
          bufferEnd,
          'slidePosition:',
          slidePosition,
          'end:',
          media.duration
        );
        connect(_caclLiveSyncPosition).map(liveSyncPostion => {
          media.currentTime = liveSyncPostion;
          logger.log(
            'break away from the live point,sync position',
            media.currentTime
          );
        });
      }
    })
  )
    .ap(getState(ACTION.PLAYLIST.IS_LIVE))
    .ap(getState(ACTION.PLAYLIST.SLIDE_POSITION));
}

_mergePlaylist = curry(_mergePlaylist);
bootStrapFlushPlaylist = curry(bootStrapFlushPlaylist);
checkSyncLivePosition = curry(checkSyncLivePosition);
export { _mergePlaylist, bootStrapFlushPlaylist, checkSyncLivePosition };

import { F, Logger, Task, Maybe, Tick } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { loadResource } from './playlist';
import { updateMediaDuration } from '../media/media';
import { getBufferInfo } from '../buffer/buffer-helper';
const { curry, prop } = F;
let logger = new Logger('player');

/**
 *  [0,1,1] -> [0,1,0]
    [0,1,1,2,2,2,3] -> [0,1,0,2,0,0,3]
    [1,1,1,2,2] -> [1,0,0,2,0]
 */
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

/**
 * live merge playlist conditions:
 * 1. current details sn [3,5], new details sn [2,4]
       current details sn [3,5], new details sn [3,5]
       current details sn [3,5], new details sn [4,6]
       current details sn [3,5], new details sn [7,9]
 2. last level 2,details sn [10,13]     level changed to 3
    level 3 detaisl sn [3,6],flushed new details [9,12]、[10,13]、[11,14]
 *
 * @param {*} param0
 * @param {*} levelId the current used level
 * @param {*} newDetails
 */
function mergePlaylist({ getState, dispatch, connect }, levelId, newDetails) {
  let noNews = false;

  getState(ACTION.PLAYLIST.FIND_LEVEL, levelId).map(level => {
    let { detail } = level;
    let oldStartSN = detail.startSN;
    let oldEndSN = detail.endSN;
    let oldSegments = detail.segments;
    let newSegments = _convertCC(newDetails.segments);
    let { startSN, endSN } = newDetails;
    let delta = startSN - oldStartSN;
    let lastSegment;
    let lastCC = 0;

    noNews = oldStartSN === startSN && oldEndSN === endSN;

    logger.log(
      `merge level ${newDetails.levelId} details with levelId ${levelId},[${oldStartSN},${oldEndSN}] -> [${startSN},${endSN}]`
    );

    let overlap =
      (startSN >= oldStartSN && startSN <= oldEndSN) ||
      (oldStartSN >= startSN && oldStartSN <= endSN);

    if (!overlap) {
      getState(ACTION.PLAYLIST.FIND_LAST_LEVEL)
        .map(prop('detail'))
        .map(prop('segments'))
        .map(olds => {
          oldSegments = olds;
          logger.log(`use last level ${olds.levelId} to sync new details`);
        });
    }

    let result = _mergeDetails(oldSegments, newSegments);
    logger.warn(
      `new levels index=${result.newIndex} match old levels index=${result.oldIndex}`
    );

    for (let i = 0; i < newSegments.length; i++) {
      let newSeg = newSegments[i];
      if (newSeg.cc) {
        lastCC++;
      }
      newSeg.cc = lastCC;
      newSeg.levelId = levelId;
      newSeg.lowestLevel = levelId === 1;
      if (i > result.newIndex) {
        newSeg.start = newSeg.origStart = newSegments[i - 1].end;
        newSeg.end = newSeg.origEnd = newSeg.start + newSeg.duration;
      }
      if (oldSegments.map(x => x.id).indexOf(newSeg.id) === -1) {
        oldSegments.push(newSeg);
      }
    }

    oldSegments = oldSegments.filter(x => x.id >= startSN);
    if (!oldSegments.length) return;
    let first = oldSegments[0];
    let last = oldSegments[oldSegments.length - 1];
    detail.segments = oldSegments;
    detail.startSN = first.id;
    detail.endSN = last.id;
    detail.mediaSequence = detail.startSN;
    detail.live = detail.live;
    detail.duration = Math.max(
      detail.duration,
      last.end,
      connect(getBufferInfo)(last.end).bufferEnd
    );
    dispatch(ACTION.PLAYLIST.UPDATE_LEVEL, { levelId, detail });
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

function _mergeDetails(oldSegments, newSegments) {
  let s;
  let oldIds = oldSegments.map(x => x.id);
  let newIds = newSegments.map(x => x.id);
  let deltas = newIds
    .map((id, index) => {
      return oldIds
        .map((oldId, oldIndex) => {
          return {
            newIndex: index,
            oldIndex,
            delta: id - oldId
          };
        })
        .filter(x => x.delta === 0);
    })
    .filter(x => x.length);

  if (deltas.length && deltas[0].length) {
    let matched = deltas[0][0];
    s = newSegments[matched.newIndex];
    s.start = oldSegments[matched.oldIndex].start;
    s.end = s.start + s.duration;
    return matched;
  }

  let oldNb = oldSegments.length - 1;
  s = newSegments[0];
  s.start = oldSegments[oldNb].start;
  s.end = s.start + s.duration;
  logger.warn(
    `no overlap between two level,assume they are aligned,set segment.id = ${s.id} start`
  );
  return {
    newIndex: 0,
    oldIndex: oldNb
  };
}

function bootStrapFlushPlaylist({ getState, dispatch, getConfig, connect }) {
  let flushTask;
  let factor = getConfig(ACTION.CONFIG.LIVE_FLUSH_INTERVAL_FACTOR);
  let interval = getState(ACTION.PLAYLIST.AVG_SEG_DURATION)
    .map(duration => duration * factor * 1000 || undefined)
    .getOrElse(1000);

  function _flushPlaylist(nextTick) {
    Maybe.of(
      curry((levelUrl, currentLevelId) => {
        let tsStart = performance.now();
        connect(loadResource)('LEVEL', levelUrl)
          .map(details => {
            let segsNb = details.segments.length;
            let noNews = connect(mergePlaylist)(currentLevelId, details);
            interval = details.targetduration * 1000 || interval;

            if (!details.live) {
              // end of live
              flushTask.destroy();
              return;
            }

            let time = interval - performance.now() + tsStart;
            time = time / (noNews ? 2 : 1);

            logger.log(`m3u8  flush after ${time} ms`);
            nextTick(time);
          })
          .error(e => {
            if (e.fatal()) {
              flushTask.destroy();
              dispatch(ACTION.ERROR, e);
            }
          });
      })
    )
      .ap(getState(ACTION.PLAYLIST.GET_LEVEL_URL))
      .ap(getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID));
  }

  flushTask = Tick.of()
    .addTask(_flushPlaylist)
    .interval(interval)
    .immediateRun();
  dispatch(ACTION.PLAYLIST.FLUSH_TASK, flushTask);
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

// number -> number when break away,nothing when not
function checkSyncLivePosition({ getState, connect, dispatch }, bufferEnd) {
  return Maybe.of(
    curry((_, slidePosition) => {
      //check the current play time is break away from the live point
      if (bufferEnd < slidePosition) {
        logger.log('bufferEnd:', bufferEnd, 'slidePosition:', slidePosition);
        return connect(_caclLiveSyncPosition).chain(liveSyncPostion => {
          logger.log(
            'break away from the live point,sync position',
            liveSyncPostion,
            'bufferEnd: ',
            bufferEnd
          );
          dispatch(ACTION.BUFFER.LIVE_LOAD_POINT, liveSyncPostion);
          return liveSyncPostion;
        });
      }
    })
  )
    .ap(getState(ACTION.PLAYLIST.IS_LIVE))
    .ap(getState(ACTION.PLAYLIST.SLIDE_POSITION))
    .getOrElse(() => {
      dispatch(ACTION.BUFFER.LIVE_LOAD_POINT, -1);
    });
}

// in ts live,check the current time break away from live windows then need to
// seek to the new buffer area
function checkSeekAfterBufferAppend({ getState }, segBound) {
  Maybe.of(
    curry((_, bufferInfo, slidePosition, media) => {
      if (bufferInfo.bufferEnd < slidePosition) {
        logger.log('media seeking to', segBound.start);
        media.currentTime = segBound.start;
      }
    })
  )
    .ap(getState(ACTION.PLAYLIST.IS_LIVE))
    .ap(getState(ACTION.BUFFER.GET_BUFFER_INFO))
    .ap(getState(ACTION.PLAYLIST.SLIDE_POSITION))
    .ap(getState(ACTION.MEDIA.MEDIA_ELE));
}

mergePlaylist = curry(mergePlaylist);
bootStrapFlushPlaylist = curry(bootStrapFlushPlaylist);
checkSyncLivePosition = curry(checkSyncLivePosition);
checkSeekAfterBufferAppend = curry(checkSeekAfterBufferAppend);

export {
  mergePlaylist,
  bootStrapFlushPlaylist,
  checkSyncLivePosition,
  checkSeekAfterBufferAppend
};

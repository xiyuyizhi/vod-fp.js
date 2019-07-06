import { F, Maybe } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from './buffer';

const { compose, map, reduce, curry, prop, join, ifElse, trace } = F;

// void -> Maybe
function _bufferSerialize(media) {
  let _serialize = buffered => {
    let arr = [];
    for (let i = 0; i < buffered.length; i++) {
      arr.push([buffered.start(i), buffered.end(i)]);
    }
    return arr;
  };
  return compose(
    map(ifElse(prop('length'), _serialize, () => [])),
    map(prop('buffered'))
  )(media);
}

function bufferDump(media) {
  return compose(
    join,
    map(
      compose(
        x => x.join(' ~~ '),
        map(x => x.join('-'))
      )
    )
  )(_bufferSerialize(media));
}

function _bufferMerge(maxBufferHole, all, c) {
  if (all.length === 0) {
    all.push(c);
    return all;
  }
  let last = all[all.length - 1];
  if (c[0] < last[1] + maxBufferHole) {
    last[1] = c[1];
  } else {
    all.push(c);
  }
  return all;
}

const _getCurrentPositionBuffer = F.curry(
  (maxFragLookUpTolerance, currentTime, buffered) => {
    return buffered.filter(
      ([start, end]) =>
        start <= currentTime + maxFragLookUpTolerance && end + maxFragLookUpTolerance >= currentTime
    )[0];
  }
);

function _bufferInfoCacl(getState, getConfig, bufferRanges, currentPosition, isSeeking) {
  let maxFragLookUpTolerance = getConfig(
    ACTION.CONFIG.MAX_FRAG_LOOKUP_TOLERANCE
  );
  let maxBufferHole = getConfig(ACTION.CONFIG.MAX_BUFFER_GAP_TOLERANCE);
  let restInfo = compose(
    map(x => {
      return {
        bufferLength: Math.max(0, parseFloat((x[1] - currentPosition).toFixed(6))),
        bufferEnd: x[1]
      };
    }),
    map(
      compose(
        _getCurrentPositionBuffer(maxFragLookUpTolerance, currentPosition),
        reduce(_bufferMerge(maxBufferHole), [])
      )
    ),
  )(bufferRanges);
  return restInfo.getOrElse(() => {
    if (isSeeking) {
      return {
        bufferLength: 0,
        bufferEnd: currentPosition
      };
    }
    return {
      bufferLength: 0,
      bufferEnd: 0
    };
  });
}

// boolean -> Maybe
function getBufferInfo({ getState, getConfig }, currentPosition, isSeeking) {
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  return _bufferInfoCacl(
    getState,
    getConfig,
    _bufferSerialize(media),
    currentPosition,
    isSeeking
  )
}

function getFlyBufferInfo({ getState, getConfig }, currentPosition, isSeeking) {

  return _bufferInfoCacl(
    getState,
    getConfig,
    getState(ACTION.FLYBUFFER.FLY_BUFFER_RANGES),
    currentPosition,
    isSeeking
  )
}

_bufferMerge = F.curry(_bufferMerge);
getBufferInfo = F.curry(getBufferInfo);
getFlyBufferInfo = F.curry(getFlyBufferInfo)
export { getBufferInfo, bufferDump, getFlyBufferInfo };

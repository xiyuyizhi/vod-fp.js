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
        start <= currentTime + maxFragLookUpTolerance && end >= currentTime
    )[0];
  }
);

// boolean -> Maybe
function getBufferInfo({ getState, getConfig }, seeking) {
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let maxFragLookUpTolerance = getConfig(
    ACTION.CONFIG.MAX_FRGA_LOOKUP_TOLERANCE
  );
  let maxBufferHole = getConfig(ACTION.CONFIG.MAX_BUFFER_HOLE);
  let currentTime = compose(
    join,
    map(prop('currentTime'))
  )(media);
  let restInfo = compose(
    map(x => {
      return {
        bufferLength: x[1] - currentTime,
        bufferEnd: x[1]
      };
    }),
    map(
      compose(
        _getCurrentPositionBuffer(maxFragLookUpTolerance, currentTime),
        reduce(_bufferMerge(maxBufferHole), [])
      )
    ),
    _bufferSerialize
  )(media);

  return restInfo.getOrElse(() => {
    if (seeking) {
      return {
        bufferLength: 0,
        bufferEnd: currentTime
      };
    }
    return {
      bufferLength: 0,
      bufferEnd: 0
    };
  });
}
_bufferMerge = F.curry(_bufferMerge);
getBufferInfo = F.curry(getBufferInfo);

export { getBufferInfo, bufferDump };

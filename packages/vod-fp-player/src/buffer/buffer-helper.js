import { F, Maybe } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from './buffer';

const { compose, map, reduce, curry, prop, join, ifElse, trace } = F;

// void -> Maybe
function bufferSerialize(media) {
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
  )(bufferSerialize(media))
}

function bufferMerge(all, c) {
  if (all.length === 0) {
    all.push(c);
    return all;
  }
  let last = all[all.length - 1];
  if (c[0] < last[1] + 0.3) {
    last[1] = c[1];
  } else {
    all.push(c);
  }
  return all;
}

const getCurrentPositionBuffer = F.curry((currentTime, buffered) => {
  return buffered.filter(
    ([start, end]) => start <= currentTime + 0.1 && end >= currentTime
  )[0];
});

// boolean -> Maybe
function getBufferInfo({ getState }, seeking) {
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
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
        getCurrentPositionBuffer(currentTime),
        reduce(bufferMerge, [])
      )
    ),
    bufferSerialize
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

getBufferInfo = F.curry(getBufferInfo);

export { bufferSerialize, getBufferInfo, bufferDump };
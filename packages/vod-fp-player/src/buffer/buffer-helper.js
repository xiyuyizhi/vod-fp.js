import { F, Maybe } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from './buffer';

const { compose, map, reduce, curry, prop, ifElse, trace } = F;

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
    ([start, end]) => start <= currentTime + 0.1 && end > currentTime
  )[0];
});

function getBufferInfo({ getState }, seeking) {
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let currentTime = map(prop('currentTime'))(media).value();
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

export { getBufferInfo };

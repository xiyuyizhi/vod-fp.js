import { F, Maybe } from 'vod-fp-utility';
import { ACTION } from '../store';
import { buffer } from './buffer';

const { compose, map, reduce, curry, prop, join, ifElse, trace } = F;

if (window.TimeRanges) {
  TimeRanges.prototype.dump = function() {
    let len = this.length;
    return new Array(len)
      .fill(0)
      .map((x, i) => [this.start(i), this.end(i)].join('-'))
      .join(' ~~~ ');
  };
}

// void -> Maybe
function _bufferSerialize(media) {
  let _serialize = buffered => {
    let arr = [];
    for (let i = 0; i < buffered.length; i++) {
      arr.push([buffered.start(i), buffered.end(i)]);
    }
    return arr;
  };
  return Maybe.of(_serialize(media.buffered));
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
        start <= currentTime + maxFragLookUpTolerance &&
        end + maxFragLookUpTolerance >= currentTime
    )[0];
  }
);

function _bufferInfoCacl(getState, getConfig, bufferRanges, currentPosition) {
  let maxFragLookUpTolerance = getConfig(
    ACTION.CONFIG.MAX_FRAG_LOOKUP_TOLERANCE
  );
  let maxBufferHole = getConfig(ACTION.CONFIG.MAX_BUFFER_GAP_TOLERANCE);
  let restInfo = compose(
    map(x => {
      return {
        bufferLength: Math.max(
          0,
          parseFloat((x[1] - currentPosition).toFixed(6))
        ),
        bufferStart: x[0],
        bufferEnd: x[1]
      };
    }),
    map(
      compose(
        _getCurrentPositionBuffer(maxFragLookUpTolerance, currentPosition),
        reduce(_bufferMerge(maxBufferHole), [])
      )
    )
  )(bufferRanges);
  return restInfo.getOrElse(() => {
    return {
      bufferLength: 0,
      bufferStart: currentPosition,
      bufferEnd: currentPosition
    };
  });
}

// boolean -> Maybe
function getBufferInfo({ getState, getConfig }, currentPosition) {
  let media = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() =>
    getState(ACTION.MEDIA.MEDIA_ELE).join()
  );
  return _bufferInfoCacl(
    getState,
    getConfig,
    _bufferSerialize(media),
    currentPosition
  );
}

function getFlyBufferInfo({ getState, getConfig }, currentPosition) {
  return _bufferInfoCacl(
    getState,
    getConfig,
    getState(ACTION.FLYBUFFER.FLY_BUFFER_RANGES),
    currentPosition
  );
}

_bufferMerge = F.curry(_bufferMerge);
getBufferInfo = F.curry(getBufferInfo);
getFlyBufferInfo = F.curry(getFlyBufferInfo);
export { getBufferInfo, bufferDump, getFlyBufferInfo };

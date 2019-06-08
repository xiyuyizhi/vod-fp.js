import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import { toMux } from '../mux/mux';

function binarySearch(list, start, end, point) {
  // start mid end
  const mid = start + Math.floor((end - start) / 2);
  if (list[mid].end < point + 0.25) {
    start = mid + 1;
    return binarySearch(list, start, end, point);
  } else if (list[mid].start > point + 0.25) {
    end = mid - 1;
    return binarySearch(list, start, end, point);
  } else {
    return list[mid];
  }
  return -1;
}

const findSegment = F.curry((segments, currentTime) => {
  return binarySearch(segments, 0, segments.length - 1, currentTime);
});

function loadSegment({ getState, connect }, segment) {
  return Task.of((resolve, reject) => {
    fetch(segment.url)
      .then(res => res.arrayBuffer())
      .then(resolve, reject);
  }).map(buffer => {
    connect(toMux)(buffer, segment.id);
  });
}

loadSegment = F.curry(loadSegment);

export { findSegment, loadSegment };

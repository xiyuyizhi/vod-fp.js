import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import { toMux, setTimeOffset } from '../mux/mux';

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

function loadSegment() {
  let lastSegment = null;
  return ({ getState, connect }, segment) => {
    return Task.of((resolve, reject) => {
      fetch(segment.url)
        .then(res => {
          if ((res.status >= 200 && res.status < 300) || res.status === 304) {
            return res.arrayBuffer();
          }
          reject({
            code: res.status,
            message: res.statusText
          });
        })
        .then(resolve, reject);
    })
      .map(buffer => {
        // check to set timeoffset
        if (
          (lastSegment && lastSegment.cc !== segment.cc) ||
          (lastSegment && segment.id - lastSegment.id !== 1)
        ) {
          connect(setTimeOffset)(segment.start);
        }
        connect(toMux)(buffer, segment.id);
        lastSegment = segment;
      })
      .error(e => {
        console.log(e);
      });
  };
}

loadSegment = F.curry(loadSegment());

export { findSegment, loadSegment };

import { F, Task } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { toMux, setTimeOffset } from '../mux/mux';
import loader from "../loader/loader"
import { Maybe } from '../../../vod-fp-utility/src';

function binarySearch(list, start, end, bufferEnd) {
  // start mid end
  let endIndex = list.length - 1;
  if (start > endIndex) {
    return endIndex;
  }
  if (end < 0) return 0;
  const mid = start + Math.floor((end - start) / 2);
  if (list[mid].end < bufferEnd + 0.25) {
    start = mid + 1;
    return binarySearch(list, start, end, bufferEnd);
  } else if (list[mid].start > bufferEnd + 0.25) {
    end = mid - 1;
    return binarySearch(list, start, end, bufferEnd);
  } else {
    return list[mid];
  }
  return -1;
}

const findSegment = F.curry((segments, bufferEnd) => {
  let seg = binarySearch(segments, 0, segments.length - 1, bufferEnd);
  if (typeof seg === 'number') {
    return Maybe.of(null)
  }
  return Maybe.of(seg)
});

const addAbortSegment = F.curry(({ dispatch }, abortable) => {
  dispatch(ACTION.ABORTABLE, abortable)
})

// segment -> Task
function loadSegment() {
  let lastSegment = null;
  return ({ getState, connect, dispatch }, segment) => {
    return loader(
      {
        url: segment.url,
        options: {
          responseType: 'arraybuffer',
        }
      },
      connect(addAbortSegment)
    ).map(buffer => {
      dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADED)
      dispatch(ACTION.REMOVE_ABORTABLE, segment.id)
      if (
        (lastSegment && lastSegment.cc !== segment.cc) ||
        (lastSegment && segment.id - lastSegment.id !== 1)
      ) {
        // check to set timeoffset
        connect(setTimeOffset)(segment.start);
      }
      connect(toMux)(buffer, segment.id);
      lastSegment = segment;
    })
      .error(e => {
        console.log('error', e);
        if (e.message === 'Abort') {
          dispatch(ACTION.PROCESS, PROCESS.IDLE)
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1)
        }
      });
  };
}
loadSegment = F.curry(loadSegment());

export { findSegment, loadSegment };

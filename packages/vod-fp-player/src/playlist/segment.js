import { F, Task, Success, Empty } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { toMux, setTimeOffset, resetInitSegment } from '../mux/mux';
import loader from '../loader/loader';


const { compose, head, map, filter } = F

function binarySearch(list, start, end, bufferEnd) {
  // start mid end
  let endIndex = list.length - 1;
  if (start > endIndex) {
    return -1;
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
  if (typeof seg === -1) {
    return Empty.of()
  }
  return Success.of(seg);
});

const addAbortSegment = F.curry((dispatch, abortable) => {
  dispatch(ACTION.ABORTABLE, abortable);
});

const abortCurrentSegment = F.curry(({ getState }) => {
  Success.of(F.curry((abortables, currentSegment) => {
    compose(
      x => x.abortAble.abort(),
      head,
      filter(x => x.id === currentSegment.url)
    )(abortables)
  }))
    .ap(getState(ACTION.ABORTABLE))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT))
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
          // timeout: 1500
        }
      },
      addAbortSegment(dispatch)
    )
      .map(buffer => {
        dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADED);
        dispatch(ACTION.REMOVE_ABORTABLE, true);
        if (
          (lastSegment && lastSegment.cc !== segment.cc) ||
          (lastSegment && segment.id - lastSegment.id !== 1)
        ) {
          // check to set timeoffset
          connect(setTimeOffset)(segment.start);
        }
        if (lastSegment && lastSegment.cc !== segment.cc) {
          connect(resetInitSegment);
        }
        dispatch(ACTION.PROCESS, PROCESS.MUXING);
        connect(toMux)(buffer, segment.id);
        lastSegment = segment;
      })
      .error(e => {
        dispatch(ACTION.REMOVE_ABORTABLE, true);
        if (e.message === 'Abort') {
          dispatch(ACTION.PROCESS, PROCESS.IDLE);
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1);
        } else {
          dispatch(ACTION.PROCESS, PROCESS.ERROR);
          dispatch(ACTION.ERROR, e)
        }
      });
  };
}
loadSegment = F.curry(loadSegment());

export { findSegment, loadSegment, abortCurrentSegment };

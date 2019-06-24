import { F, Task, Success, Empty, Maybe, CusError } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { toMux, setTimeOffset, resetInitSegment } from '../mux/mux';
import loader from '../loader/loader';
import { SEGMENT_ERROR, XHR_ERROR } from '../error';

const { compose, head, map, filter } = F;

function _binarySearch(tolerance, list, start, end, bufferEnd) {
  if (start > end) {
    return -1;
  }
  const mid = start + Math.floor((end - start) / 2);
  if (list[mid].end < bufferEnd + tolerance) {
    start = mid + 1;
    return _binarySearch(tolerance, list, start, end, bufferEnd);
  } else if (list[mid].start > bufferEnd + tolerance) {
    end = mid - 1;
    return _binarySearch(tolerance, list, start, end, bufferEnd);
  } else {
    return list[mid];
  }
  return -1;
}

function findSegment({ getConfig }, segments, bufferEnd) {
  let maxFragLookUpTolerance = getConfig(
    ACTION.CONFIG.MAX_FRGA_LOOKUP_TOLERANCE
  );
  let seg = _binarySearch(
    maxFragLookUpTolerance,
    segments,
    0,
    segments.length - 1,
    bufferEnd
  );
  if (seg === -1) {
    return;
  }
  return seg;
}

function findSegmentOfCurrentPosition({ getState, connect, getConfig }) {
  return Maybe.of(
    F.curry((segments, media) => {
      return connect(findSegment)(segments, media.currentTime);
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.MEDIA.MEDIA_ELE));
}

function abortCurrentSegment({ getState }) {
  let currentSegmentUrl = getState(ACTION.PLAYLIST.CURRENT_SEGMENT).map(
    x => x.url
  );
  let inProcess = getState(ACTION.PROCESS).map(x =>
    x === PROCESS.SEGMENT_LOADING ? true : undefined
  );

  Maybe.of(
    F.curry(segUrl => {
      compose(
        map(x => x.xhr.abort()),
        map(head),
        map(filter(x => x.id === segUrl))
      )(getState(ACTION.ABORTABLE));
    })
  )
    .ap(currentSegmentUrl)
    .ap(inProcess);
}

// segment -> Task
function loadSegment() {
  let lastSegment = null;
  return ({ getConfig, getState, connect, dispatch }, segment) => {
    dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADING);
    return connect(loader)({
      url: segment.url,
      options: {
        responseType: 'arraybuffer',
        timeout: getConfig(ACTION.CONFIG.MAX_TIMEOUT)
      }
    })
      .map(buffer => {
        dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADED);
        if (
          (lastSegment && lastSegment.cc !== segment.cc) ||
          (lastSegment && lastSegment.levelId !== segment.levelId)
        ) {
          connect(resetInitSegment);
        }
        if (
          (lastSegment && lastSegment.cc !== segment.cc) ||
          (lastSegment && lastSegment.levelId !== segment.levelId) ||
          (lastSegment && segment.id - lastSegment.id !== 1)
        ) {
          connect(setTimeOffset)(segment.start);
        }
        dispatch(ACTION.PROCESS, PROCESS.MUXING);
        connect(toMux)(
          buffer,
          segment.id,
          getState(ACTION.PLAYLIST.FIND_KEY_INFO).value()
        );
        lastSegment = segment;
      })
      .filterRetry(e => !e.is(XHR_ERROR.ABORT))
      .retry(
        getConfig(ACTION.CONFIG.REQUEST_RETRY_COUNT),
        getConfig(ACTION.CONFIG.REQUEST_RETRY_DELAY)
      )
      .error(e => {
        if (e.is(XHR_ERROR.ABORT)) {
          getState(ACTION.PROCESS)
            .map(x => (x !== PROCESS.LEVEL_CHANGING ? true : undefined))
            .map(() => {
              dispatch(ACTION.PROCESS, PROCESS.IDLE);
            });
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, -1);
        } else {
          dispatch(
            ACTION.ERROR,
            e.merge(CusError.of(SEGMENT_ERROR[e.detail()]))
          );
        }
      });
  };
}
abortCurrentSegment = F.curry(abortCurrentSegment);
findSegment = F.curry(findSegment);
loadSegment = F.curry(loadSegment());
findSegmentOfCurrentPosition = F.curry(findSegmentOfCurrentPosition);

export {
  findSegment,
  loadSegment,
  abortCurrentSegment,
  findSegmentOfCurrentPosition
};

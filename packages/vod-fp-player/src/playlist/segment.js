import { F, Task } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { toMux, setTimeOffset } from '../mux/mux';
import loader from "../loader/loader"

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

const addAbortSegment = F.curry(({ dispatch }, abortable) => {
  dispatch(ACTION.ABORTABLE, abortable)
})

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
        }
      });
  };
}
//http://player.youku.com/?url=https://valipl-vip.cp31.ott.cibntv.net/6974BA40D364E71FD37F725D7/03000600005C3DBEFE016F3011BA6AF1D8A2E7-3A8F-4527-897F-A94A1BF056FA-1-114.m3u8?ccode=0502&duration=1420&expire=1000&psid=b773a44ac07d12d78bccede62cfcc16d&ups_client_netip=6a0b29d4&ups_ts=1560256418&ups_userid=1081877852&ut
loadSegment = F.curry(loadSegment());

export { findSegment, loadSegment };

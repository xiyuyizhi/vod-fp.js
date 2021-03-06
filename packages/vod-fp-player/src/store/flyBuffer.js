import { F } from 'vod-fp-utility';

const { map, prop, compose, filter, head, trace } = F;

export default {
  module: 'FLYBUFFER',
  ACTION: {
    FLY_BUFFER_RANGES: 'flyBufferRanges',
    STORE_NEW_SEGMENT: 'storeNewSegment',
    GET_MATCHED_SEGMENT: 'getMatchedSegment',
    GET_FIRST_SEGMENT_BEYOND_CURRENTTIME: 'getFirstSegmentBeyondCurrentTime',
    REMOVE_SEGMENT_FROM_STORE: 'removeSegmentFromStore',
    LAST_APPENDED_SEGMENT: 'lastAppendedSegment'
  },
  getState() {
    return {
      segmentsStore: [],
      lastAppendedSegment: null,
      derive: {
        flyBufferRanges(state) {
          return compose(
            map(x => x.sort((a, b) => (a[0] < b[0] && a[1] < b[1] ? -1 : 1))),
            map(map(x => [x.start, x.end])),
            map(map(prop('segment'))),
            map(prop('segmentsStore'))
          )(state);
        },
        storeNewSegment(state, segment) {
          trace('log: do store')(segment);
          state.map(x => x.segmentsStore.push(segment));
        },
        removeSegmentFromStore(state, id) {
          if (id) {
            return state.map(s => {
              s.segmentsStore = s.segmentsStore.filter(
                x => x.segment.id !== id
              );
              return s;
            });
          }
          return state.map(s => {
            s.segmentsStore = [];
            return s;
          });
        },
        getMatchedSegment(state, segment) {
          return compose(
            map(trace('log: do mux and append')),
            map(head),
            map(filter(x => x.segment.id === segment.id)),
            map(prop('segmentsStore'))
          )(state);
        },
        getFirstSegmentBeyondCurrentTime(state, currentTime) {
          return compose(
            map(prop('segment')),
            map(head),
            map(filter(x => x.segment.start >= currentTime)),
            map(prop('segmentsStore'))
          )(state);
        }
      }
    };
  }
};

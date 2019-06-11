import { F } from 'vod-fp-utility';
import { Maybe } from '../../../vod-fp-utility/src';
import { curry } from '../../../vod-fp-utility/src/fp/core';

const { prop, compose, map, head, filter, trace } = F;
const ACTION = {
  LEVELS: 'levels',
  CURRENT_LEVEL_ID: 'currentLevelId',
  CURRENT_LEVEL: 'currentLevel',
  SEGMENTS: 'segments',
  CURRENT_SEGMENT_ID: 'currentSegmentId',
  CURRENT_SEGMENT: 'currentSegment',
  DURATION: 'duration'
};

function getCurrentLevel(state) {
  let currentLevelId = state.map(prop('currentLevelId')).join();
  return map(
    compose(
      head,
      filter(x => x.levelId === currentLevelId),
      prop('levels')
    )
  )(state);
}

const state = {
  currentSegmentId: -1,
  currentLevelId: 1,
  levels: [],
  derive: {
    currentLevelId(state, payload) {
      if (!payload) {
        return map(prop('currentLevelId'))(state);
      }
      return state.map(x => {
        x.currentLevelId = payload;
        return x;
      });
    },
    currentLevel(state, payload) {
      if (!payload) {
        return getCurrentLevel(state);
      }
    },
    segments(state, payload) {
      if (!payload) return map(prop('segments'))(getCurrentLevel(state));
      // return map(
      //   compose(
      //     x => {
      //       x.segments = payload;
      //       return x;
      //     },
      //     prop('currentLevel')
      //   )
      // )(state);
    },
    currentSegment(state, payload) {
      if (!payload) {
        return Maybe.of(
          curry((segments, id) => {
            return segments[id];
          })
        )
          .ap(map(prop('segments'))(getCurrentLevel(state)))
          .ap(state.map(prop('currentSegmentId')));
      }
    },
    duration(state, payload) {
      if (!payload) {
        return map(prop('duration'))(getCurrentLevel(state))
      }
    }
  }
};

export default { module: 'PLAYLIST', ACTION, state };

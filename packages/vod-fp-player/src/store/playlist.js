import { F } from 'vod-fp-utility';

const { prop, compose, map, head, filter, trace } = F;
const ACTION = {
  PLAYLIST: 'playlist',
  CURRENT_LEVEL_ID: 'currentLevelId',
  CURRENT_LEVEL: 'currentLevel',
  SEGMENTS: 'segments',
  CURRENT_SEGMENT: 'currentSegment'
};

function getCurrentLevel(state) {
  let currentLevelId = state.value().currentLevelId;
  return map(
    compose(
      head,
      filter(x => x.levelId === currentLevelId),
      prop('levels')
    )
  )(state);
}

const state = {
  currentSegment: -1,
  playlist: {
    levels: [],
    currentLevelId: -1
  },
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
      return map(
        compose(
          x => {
            x.segments = payload;
            return x;
          },
          prop('currentLevel')
        )
      )(state);
    }
  }
};

export default { module: 'PLAYLIST', ACTION, state };

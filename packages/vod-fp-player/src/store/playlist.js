import { F } from 'vod-fp-utility';

const { prop, compose, map, head, filter, trace } = F;
const ACTION = {
  PLAYLIST: 'playlist',
  CURRENT_LEVEL_ID: 'currentLevelId',
  CURRENT_LEVEL: 'currentLevel',
  SEGMENTS: 'segments'
};

const state = {
  playlist: {
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
        return map(
          compose(
            head,
            filter(x => x.levelId === state.value().currentLevelId),
            prop('levels')
          )
        )(state);
      }
    },
    segments(state, payload) {
      if (!payload)
        return map(
          compose(
            prop('segments'),
            prop('currentLevel')
          )
        )(state);
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

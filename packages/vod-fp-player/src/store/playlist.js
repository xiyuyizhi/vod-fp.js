import { F } from 'vod-fp-utility';

const { prop, compose, map } = F;
const ACTION = {
  PLAYLIST: 'playlist',
  CURRENT_LEVEL: 'currentLevel',
  SEGMENTS: 'segments'
};

const state = {
  playlist: {
    currentLevel: -1
  },
  derive: {
    currentLevel(state, payload) {
      if (!payload) {
        return map(prop('currentLevel'))(state);
      }
      return state.map(x => {
        x.currentLevel = payload;
        return x;
      });
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

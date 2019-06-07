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
      return state.map(x => (x.currentLevel = payload));
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
          x => (x.segments = payload),
          prop('currentLevel')
        )
      )(state);
    }
  }
};

/**
 * dispatch(ACTION.PLAYLIST,playlist)
 * dispatch(ACTION.CURRENT_LEVEL,newLevelId)
 * getState(ACTION.CURRENT_LEVEL)
 * getState(ACTION.PLAYLIST)
 * subscribe(ACTION.CURRENT_LEVEL,()=>{
 * })
 */

export default { module: 'PLAYLIST', ACTION, state };

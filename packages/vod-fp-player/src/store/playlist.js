import { F } from 'vod-fp-utility';
import { Maybe } from '../../../vod-fp-utility/src';

const { prop, curry, compose, map, head, join, filter, trace } = F;
const ACTION = {
  PL: 'pl',
  CURRENT_LEVEL_ID: 'currentLevelId',
  CURRENT_SEGMENT_ID: 'currentSegmentId',
  CURRENT_LEVEL: 'currentLevel',
  FIND_LEVEL: 'findLevel',
  FIND_MEDIA: 'findMedia',
  FIND_KEY_INFO: 'findKeyInfo',
  UPDATE_MEDIA: 'updateMedia',
  UPDATE_KEY: 'updateKey',
  SEGMENTS: 'segments',
  CURRENT_SEGMENT: 'currentSegment',
  DURATION: 'duration',
  SEGMENTS_LEN: 'segmentsLen',
  UPDATE_LEVEL: 'updateLevel'
};

function getCurrentLevel(state) {
  let currentLevelId = state.map(prop('currentLevelId')).join();
  return getLevelById(state, currentLevelId);
}

function getLevelById(state, id) {
  return map(
    compose(
      head,
      filter(x => x.levelId === id),
      prop('levels'),
      prop('pl')
    )
  )(state);
}

function findMedia(state, type, groupId) {
  return compose(
    join,
    map(head),
    map(filter(x => x.type === type && x.groupId === groupId)),
    map(prop('medias')),
    map(prop('pl'))
  )(state);
}
findMedia = curry(findMedia);

const state = {
  pl: {
    levels: [
      {
        levelId: 1,
        detail: {}
      }
    ]
  },
  currentSegmentId: -1,
  currentLevelId: 1,
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
    currentLevel(state) {
      return getCurrentLevel(state);
    },
    findLevel(state, payload) {
      return map(
        compose(
          head,
          filter(x => x.levelId === payload),
          prop('levels'),
          prop('pl')
        )
      )(state);
    },
    findMedia(state, payload) {
      if (payload) {
        return compose(
          map(findMedia(state, 'AUDIO')),
          map(prop('audio'))
        )(getLevelById(state, payload));
      }
    },
    findKeyInfo(state, payload) {
      if (!payload) {
        return compose(
          map(prop('key')),
          map(prop('detail'))
        )(getCurrentLevel(state));
      }
    },
    updateLevel(state, payload) {
      let { levelId, detail } = payload;
      return state.map(x => {
        compose(
          level => {
            detail.segments.forEach(seg => (seg.levelId = levelId));
            level.detail = detail;
          },
          head,
          filter(x => x.levelId === levelId),
          prop('levels'),
          prop('pl')
        )(x)
        return x
      });
    },
    updateMedia(state, payload) {
      if (payload) {
        let { levelId, detail } = payload;
        compose(
          map(x => {
            x.detail = detail;
            x.detail.segments.forEach(seg => (seg.levelId = levelId));
          }),
          map(findMedia(state, 'AUDIO')),
          map(prop('audio'))
        )(getLevelById(state, levelId));
      }
    },
    updateKey(state, payload) {
      let { levelId, key } = payload;
      let level = getLevelById(state, levelId);
      compose(
        map(x => {
          x.key = key;
        }),
        map(prop('key')),
        map(prop('detail'))
      )(level);
    },
    segments(state) {
      return compose(
        map(prop('segments')),
        map(prop('detail'))
      )(getCurrentLevel(state));
    },
    currentSegment(state) {
      return Maybe.of(
        curry((segments, id) => {
          return segments[id];
        })
      )
        .ap(
          map(
            compose(
              prop('segments'),
              prop('detail')
            )
          )(getCurrentLevel(state))
        )
        .ap(state.map(prop('currentSegmentId')));
    },
    duration(state, payload) {
      if (!payload) {
        return map(
          compose(
            prop('duration'),
            prop('detail')
          )
        )(getCurrentLevel(state));
      }
    },
    segmentsLen(state) {
      return map(
        compose(
          prop('length'),
          prop('segments'),
          prop('detail')
        )
      )(getCurrentLevel(state));
    }
  }
};

export default { module: 'PLAYLIST', ACTION, getState() { return state } };

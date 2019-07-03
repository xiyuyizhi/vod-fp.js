import { F, Logger } from 'vod-fp-utility';
import { Maybe } from '../../../vod-fp-utility/src';
import { bufferDump } from '../buffer/buffer-helper';

const { prop, curry, compose, map, head, join, filter, trace } = F;
let logger = new Logger('player');
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
  UPDATE_LEVEL: 'updateLevel',
  UPDATE_SEGMENTS_BOUND: 'updateSegmentsBound',
  FIND_MEDIA_SEGEMENT: 'findMediaSegment'
};

function _getCurrentLevel(state) {
  let currentLevelId = state.map(prop('currentLevelId')).join();
  return _getLevelById(state, currentLevelId);
}

function _getLevelById(state, id) {
  return map(
    compose(
      head,
      filter(x => x.levelId === id),
      prop('levels'),
      prop('pl')
    )
  )(state);
}

function _findMedia(state, type, groupId) {
  return compose(
    join,
    map(head),
    map(filter(x => x.type === type && x.groupId === groupId)),
    map(prop('medias')),
    map(prop('pl'))
  )(state);
}
_findMedia = curry(_findMedia);

export default {
  module: 'PLAYLIST',
  ACTION,
  getState() {
    return {
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
          return _getCurrentLevel(state);
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
          return compose(
            map(_findMedia(state, 'AUDIO')),
            map(prop('audio'))
          )(_getLevelById(state, payload));
        },
        findMediaSegment(state, payload) {
          let { levelId, id } = payload;
          return compose(
            map(prop(`${id}`)),
            map(prop('segments')),
            map(prop('detail'))
          )(this.findMedia(state, levelId));
        },
        findKeyInfo(state) {
          return compose(
            map(prop('key')),
            map(prop('detail'))
          )(_getCurrentLevel(state));
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
            )(x);
            return x;
          });
        },
        updateMedia(state, payload) {
          if (payload) {
            let { levelId, detail } = payload;
            compose(
              map(x => {
                x.detail = detail;
                x.detail.segments.forEach(seg => (seg.levelId = levelId));
              })
            )(this.findMedia(state, levelId));
          }
        },
        updateKey(state, payload) {
          let { levelId, key } = payload;
          let level = _getLevelById(state, levelId);
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
          )(_getCurrentLevel(state));
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
              )(_getCurrentLevel(state))
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
            )(_getCurrentLevel(state));
          }
        },
        segmentsLen(state) {
          return map(
            compose(
              prop('length'),
              prop('segments'),
              prop('detail')
            )
          )(_getCurrentLevel(state));
        },
        updateSegmentsBound(state, payload) {
          let { segBound, media } = payload;
          Maybe.of(
            curry((segments, currentId) => {
              let { start, end } = segBound;
              segments[currentId].start = start;
              segments[currentId].end = end;
              segments[currentId].duration = parseFloat(
                (end + start).toFixed(6)
              );
              logger.log('new buffer:', [start, end], bufferDump(media));
              let len = segments.length - 1;
              for (let i = currentId + 1; i <= len; i++) {
                segments[i].start = segments[i - 1].end;
                segments[i].end = parseFloat(
                  (segments[i].start + segments[i].duration).toFixed(6)
                );
              }
            })
          )
            .ap(this.segments(state))
            .ap(state.map(prop('currentSegmentId')));
        }
      }
    };
  }
};

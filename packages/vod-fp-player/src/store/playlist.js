import { F, Logger } from 'vod-fp-utility';
import { Maybe } from '../../../vod-fp-utility/src';
import { bufferDump } from '../buffer/buffer-helper';

const { prop, curry, compose, map, head, join, filter, trace } = F;
let logger = new Logger('player');
const ACTION = {
  PL: 'pl',
  FORMAT: 'format',
  MODE: 'mode',
  CURRENT_LEVEL_ID: 'currentLevelId',
  CURRENT_SEGMENT_ID: 'currentSegmentId',
  CURRENT_LEVEL: 'currentLevel',
  FIND_LEVEL: 'findLevel',
  FIND_MEDIA: 'findMedia',
  FIND_KEY_INFO: 'findKeyInfo',
  FIND_INIT_MP4: 'findInitMp4',
  UPDATE_MEDIA: 'updateMedia',
  UPDATE_KEY: 'updateKey',
  SEGMENTS: 'segments',
  CURRENT_SEGMENT: 'currentSegment',
  DURATION: 'duration',
  SEGMENTS_LEN: 'segmentsLen',
  UPDATE_LEVEL: 'updateLevel',
  UPDATE_SEGMENTS_BOUND: 'updateSegmentsBound',
  FIND_MEDIA_SEGEMENT: 'findMediaSegment',
  COLLECT_DOWNLOAD_TIME: 'collectDownloadTime',
  GET_DOWNLOAD_SPEED: 'getDownloadSpeed'
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
      speedList: [],
      currentSegmentId: -1,
      currentLevelId: 1,
      format: 'ts', //ts | fmp4 | flv
      derive: {
        format(state) {
          return compose(
            map(uri => {
              if (/(mp4|m4s)/.test(uri)) return 'fmp4';
            }),
            map(prop('uri')),
            map(prop('map')),
            map(prop('detail')),
            map(head),
            map(prop('levels')),
            map(prop('pl'))
          )(state).getOrElse('ts');
        },
        mode(state) {
          return compose(
            map(prop('type')),
            map(prop('pl'))
          )(state).getOrElse('level');
        },
        currentLevelId(state, levelId) {
          if (!levelId) {
            return map(prop('currentLevelId'))(state);
          }
          return state.map(x => {
            x.currentLevelId = levelId;
            return x;
          });
        },
        currentLevel(state) {
          return _getCurrentLevel(state);
        },
        findLevel(state, levelId) {
          return map(
            compose(
              head,
              filter(x => x.levelId === levelId),
              prop('levels'),
              prop('pl')
            )
          )(state);
        },
        findMedia(state, levelId) {
          return compose(
            map(_findMedia(state, 'AUDIO')),
            map(prop('audio'))
          )(_getLevelById(state, levelId));
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
        findInitMp4(state) {
          let _getInitUrl = level => {
            return level
              .map(prop('detail'))
              .map(prop('map'))
              .map(prop('uri'));
          };
          let level = _getCurrentLevel(state);
          let media = this.findMedia(state, level.map(prop('levelId')).join());
          return Maybe.of(
            curry((levelInitMp4, mediaInitMp4) => {
              return {
                levelInitMp4,
                mediaInitMp4
              };
            })
          )
            .ap(_getInitUrl(level))
            .ap(_getInitUrl(media));
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
        duration(state) {
          return map(
            compose(
              prop('duration'),
              prop('detail')
            )
          )(_getCurrentLevel(state));
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
        updateSegmentsBound(state, segBound, { getState, ACTION }) {
          Maybe.of(
            curry((segments, currentId) => {
              let { start, end } = segBound;
              let seg = segments.find(x => x.id === currentId);
              seg.start = start;
              seg.end = end;
              seg.duration = parseFloat((end + start).toFixed(6));
              logger.log(
                'new buffer:',
                [start, end],
                bufferDump(getState(ACTION.MEDIA.MEDIA_ELE).join())
              );
              let len = segments.length - 1;
              segments.forEach((x, index) => {
                if (x.id > currentId) {
                  x.start = segments[index - 1].end;
                  x.end = parseFloat((x.start + x.duration).toFixed(6));
                }
              });
            })
          )
            .ap(this.segments(state))
            .ap(
              state.map(prop('currentSegmentId')).map(id => {
                if (id == -1) return;
                return id;
              })
            );
        },
        collectDownloadTime(state, speed) {
          return state.map(x => {
            if (x.speedList.length > 40) {
              x.speedList = x.speedList.slice(25);
            }
            x.speedList.push(speed);
            return x;
          });
        },
        getDownloadSpeed(state) {
          return state.map(x => {
            let len = x.speedList.length;
            let avgSpeed =
              x.speedList.reduce((all, c) => {
                all += c;
                return all;
              }, 0) / len;
            if (this.lastSpeed && this.lastSpeed === avgSpeed) {
              return '0KB/s';
            }
            this.lastSpeed = avgSpeed;
            if (avgSpeed > 1) {
              return avgSpeed.toFixed(2) + 'MB/s';
            }
            return (avgSpeed * 1000).toFixed(2) + 'KB/s';
          });
        }
      }
    };
  }
};

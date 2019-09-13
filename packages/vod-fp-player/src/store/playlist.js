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
  LAST_LEVEL_ID: 'lastLevelId',
  CURRENT_SEGMENT_ID: 'currentSegmentId',
  CURRENT_LEVEL: 'currentLevel',
  LEVELS: 'levels',
  FIND_LEVEL: 'findLevel',
  FIND_LAST_LEVEL: 'findLastLevel',
  FIND_MEDIA: 'findMedia',
  FIND_KEY_INFO: 'findKeyInfo',
  FIND_INIT_MP4_URLS: 'findInitMp4Urls',
  MP4_METADATA: 'mp4Metadata',
  UPDATE_MEDIA: 'updateMedia',
  UPDATE_KEY: 'updateKey',
  SEGMENTS: 'segments',
  CURRENT_SEGMENT: 'currentSegment',
  DURATION: 'duration',
  AVG_SEG_DURATION: 'avgSegDuration',
  SEGMENTS_LEN: 'segmentsLen',
  UPDATE_LEVEL: 'updateLevel',
  UPDATE_SEGMENTS_BOUND: 'updateSegmentsBound',
  FIND_MEDIA_SEGEMENT: 'findMediaSegment',
  CAN_ABR: 'canAbr',
  IS_LIVE: 'isLive',
  GET_LEVEL_URL: 'getLevelUrl',
  FLUSH_TASK: 'flushTask',
  REMOVE_FLUSH_TASK: 'removeFlushTask',
  SLIDE_POSITION: 'slidePosition' //直播窗口滑动点
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
      lastLevelId: 1,
      currentLevelId: 1,
      flushTask: null,
      format: '', //ts | fmp4 | flv
      derive: {
        format(state, _, { getConfig, ACTION }) {
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
          )(state).getOrElse(() => {
            return getConfig(ACTION.CONFIG.FLV_LIVE) ? 'flvLive' : 'ts';
          });
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
        levels(state) {
          return map(
            compose(
              prop('levels'),
              prop('pl')
            )
          )(state);
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
        findLastLevel(state) {
          return state.chain(x => this.findLevel(state, x.lastLevelId));
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
        findInitMp4Urls(state) {
          let _getInitUrl = level => {
            return level
              .map(prop('detail'))
              .map(prop('map'))
              .map(prop('uri'));
          };
          let level = _getCurrentLevel(state);
          let media = this.findMedia(state, this.currentLevelId(state).join());
          return Maybe.of(
            curry((levelInitMp4Url, mediaInitMp4Url) => {
              return {
                levelInitMp4Url,
                mediaInitMp4Url
              };
            })
          )
            .ap(_getInitUrl(level))
            .ap(_getInitUrl(media));
        },
        mp4Metadata(state, payload) {
          let { levelId, buffer } = payload;
          if (buffer) {
            let { videoBuffer, audioBuffer } = buffer;
            let currentLevel = this.findLevel(state, levelId);
            currentLevel.map(level => (level['metadata'] = videoBuffer));
            this.findMedia(state, levelId).map(
              media => (media['metadata'] = audioBuffer)
            );
            return;
          }
          return Maybe.of(
            curry((levelInit, mediaInit) => {
              return {
                levelInit,
                mediaInit
              };
            })
          )
            .ap(this.findLevel(state, levelId).map(prop('metadata')))
            .ap(this.findMedia(state, levelId).map(prop('metadata')));
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
        avgSegDuration(state) {
          return map(
            compose(
              prop('targetduration'),
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
              if (!seg) return;
              seg.start = start;
              seg.end = end;
              seg.duration = parseFloat((end - start).toFixed(6));
              logger.log(
                'new buffer:',
                [start, end],
                '\n video buffer: ',
                getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER)
                  .map(sb => bufferDump(sb))
                  .join(),
                '\n audio buffer: ',
                getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER)
                  .map(sb => bufferDump(sb))
                  .join()
              );
              let len = segments.length - 1;
              segments.forEach((x, index) => {
                if (x.id > currentId) {
                  x.start = segments[index - 1].end;
                  x.end = parseFloat((x.start + x.duration).toFixed(6));
                }
              });
              getState(ACTION.PLAYLIST.IS_LIVE).map(() => {
                let pres = segments.filter(x => x.id <= currentId);
                for (let i = pres.length - 1; i > 0; i--) {
                  pres[i - 1].end = pres[i].start;
                  pres[i - 1].start = pres[i - 1].end - pres[i - 1].duration;
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
        canAbr(state, _, { getConfig, ACTION }) {
          return state.map(x => {
            if (
              getConfig(ACTION.CONFIG.ABR_ENABLE) &&
              this.mode(state) === 'master' &&
              this.levels(state)
                .map(prop('length'))
                .join() !== 1
            ) {
              return true;
            }
          });
        },
        isLive(state) {
          return compose(
            map(x => (prop('live')(x) ? true : undefined)),
            map(prop('detail'))
          )(this.currentLevel(state));
        },
        getLevelUrl(state) {
          return compose(
            map(prop('url')),
            map(prop('detail'))
          )(this.currentLevel(state));
        },
        slidePosition(state) {
          return this.segments(state)
            .map(head)
            .map(x => x.start);
        },
        removeFlushTask(state) {
          state.map(prop('flushTask')).map(x => x.destroy());
        }
      }
    };
  }
};

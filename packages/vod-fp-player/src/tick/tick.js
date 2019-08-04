import { F, Tick, Maybe, Success, Empty, Logger } from 'vod-fp-utility';
import { ACTION, PROCESS, LOADPROCESS } from '../store';
import {
  findSegment,
  loadSegment,
  loadInitMP4,
  drainSegmentFromStore
} from '../playlist/segment';
import { abrBootstrap, abrProcess } from '../abr/abr';
import { muxBootstrap } from '../mux/mux';
import { bufferBootstrap } from '../buffer/buffer';
import { updateMediaDuration } from '../media/media';
import {
  bootStrapFlushPlaylist,
  checkSyncLivePosition
} from '../playlist/m3u8-live';

const { prop, compose, map, curry } = F;

let logger = new Logger('player');

function bootstrap(
  { getState, getConfig, connect, dispatch, subOnce },
  level,
  mediaSource
) {
  if (!level) return;

  connect(updateMediaDuration);
  let format = getState(ACTION.PLAYLIST.FORMAT);
  if (format === 'ts') {
    connect(muxBootstrap);
  }
  if (format === 'fmp4') {
    connect(loadInitMP4)(true);
  }
  getState(ACTION.PLAYLIST.CAN_ABR).map(() => {
    connect(abrBootstrap);
  });

  getState(ACTION.PLAYLIST.IS_LIVE).map(() => {
    connect(bootStrapFlushPlaylist);
  });

  connect(bufferBootstrap);

  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let startLoadProcess = connect(_startLoadProcess);

  function _checkBuffer() {
    // real buffer
    Maybe.of(
      curry((bufferInfo, m, pro, segments) => {
        if (
          bufferInfo.bufferLength <
            getConfig(ACTION.CONFIG.MAX_BUFFER_LENGTH) &&
          pro === PROCESS.IDLE
        ) {
          let bufferEnd = bufferInfo.bufferEnd;
          connect(checkSyncLivePosition)(m, bufferEnd);
          return connect(findSegment)(segments, bufferEnd);
        } else if (m.currentTime && (m.paused || m.end)) {
          dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
        }
      })
    )
      .ap(getState(ACTION.BUFFER.GET_BUFFER_INFO))
      .ap(media)
      .ap(getState(ACTION.PROCESS))
      .ap(getState(ACTION.PLAYLIST.SEGMENTS))
      .map(connect(drainSegmentFromStore))
      .getOrElse(e => {
        logger.log('continue check buffer');
      });
  }

  function _checkDownload(nextTick) {
    // fly buffer
    Maybe.of(
      curry((flyBuffer, loadProcess) => {
        let MAX_FLY_BUFFER_LENGTH = getConfig(
          ACTION.CONFIG.MAX_FLY_BUFFER_LENGTH
        );
        if (
          flyBuffer.bufferLength > MAX_FLY_BUFFER_LENGTH ||
          loadProcess === LOADPROCESS.SEGMENT_LOADING
        )
          return;
        return flyBuffer;
      })
    )
      .ap(getState(ACTION.BUFFER.GET_FLY_BUFFER_INFO))
      .ap(getState(ACTION.LOADPROCESS))
      .map(flyBuffer => {
        subOnce(ACTION.LOADPROCESS, () => {
          nextTick();
        });
        return flyBuffer;
      })
      .map(startLoadProcess)
      .getOrElse(e => {
        logger.log(e || 'continue check load');
        nextTick(300);
      });
  }

  let t = Tick.of()
    .addTask(_checkBuffer)
    .addTask(_checkDownload)
    .interval(getConfig(ACTION.CONFIG.TICK_INTERVAL))
    .immediateRun();
  dispatch(ACTION.MAIN_LOOP, t);
}

function _startLoadProcess(
  { getState, getConfig, dispatch, connect },
  bufferInfo
) {
  return getState(ACTION.PLAYLIST.SEGMENTS)
    .map(x => connect(findSegment)(x, bufferInfo.bufferEnd))
    .map(segment => {
      logger.groupEnd();
      logger.group(
        'current segment ',
        segment.id,
        ' of level ',
        segment.levelId || 1,
        ' with cc ',
        segment.cc,
        `: [${segment.start} , ${segment.end}]`
      );
      getState(ACTION.PLAYLIST.CAN_ABR).map(() => {
        connect(abrProcess)(segment);
      });
      connect(loadSegment)(segment);
      return true;
    })
    .getOrElse(Empty.of('no found segement'));
}

_startLoadProcess = curry(_startLoadProcess);
bootstrap = F.curry(bootstrap);

export { bootstrap };

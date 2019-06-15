import { F, Tick, Maybe, Success, Empty } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from '../buffer/buffer-helper';
import { findSegment, loadSegment } from '../playlist/segment';
import { createMux } from '../mux/mux';
import { buffer } from '../buffer/buffer';
import { updateMediaDuration } from '../media/media';

const { prop, compose, map, curry } = F;

function _loadCheck({ dispatch }, bufferInfo, process, media) {
  if (bufferInfo.bufferLength > 15 || process !== PROCESS.IDLE || media.ended) {
    if (media.paused || media.ended) {
      dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
    }
    return;
  }
  return bufferInfo;
}

function _startProcess({ getState, dispatch, connect }, rest) {
  let segments = getState(ACTION.PLAYLIST.SEGMENTS);
  let segment = segments.map(x => findSegment(x, rest.bufferEnd));
  return Maybe.of(
    curry((segment, segments, currentId) => {
      if (currentId === segment.id) {
        segment = segments[currentId + 1];
        console.warn(`segment ${currentId} 已下载,下载下一分片`);
      }
      return segment;
    })
  )
    .ap(segment)
    .ap(segments)
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))
    .map(segment => {
      console.groupEnd();
      console.group('current segment ', segment.id);
      console.log('restBuffer: ', rest);
      dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADING);
      dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
      connect(loadSegment)(segment);
      return true;
    })
    .getOrElse(Empty.of('no found segement'));
}

function tick({ getState, connect, dispatch }, level, mediaSource) {
  if (!level) return;
  connect(updateMediaDuration);
  connect(createMux);
  connect(buffer);
  let timer = null;
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let startProcess = connect(_startProcess);
  let check = connect(_loadCheck);

  function _startTimer() {
    let rest = map(
      compose(
        connect(getBufferInfo),
        prop('seeking')
      )
    )(media);
    Maybe.of(check)
      .ap(rest)
      .ap(getState(ACTION.PROCESS))
      .ap(media)
      .map(startProcess)
      .getOrElse(e => {
        console.log(e || 'continue check');
      });
  }

  let t = Tick.of(_startTimer)
    .interval(1000)
    .immediate();
  dispatch(ACTION.MAIN_LOOP, t);
}

_loadCheck = curry(_loadCheck);
_startProcess = curry(_startProcess);
const startTick = F.curry(tick);

export { startTick };

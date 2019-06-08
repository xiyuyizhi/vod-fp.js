import { F } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from '../buffer/buffer-helper';
import { findSegment, loadSegment } from '../playlist/segment';
import { createMux } from '../mux/mux';
import { buffer } from '../buffer/buffer';
const { prop } = F;

function tick({ getState, connect, dispatch }, playlist, mediaSource) {
  let timer = null;
  mediaSource.duration = playlist.duration;
  connect(createMux);
  connect(buffer);

  timer = setInterval(() => {
    let rest = connect(getBufferInfo).getOrElse({
      bufferLength: 0,
      bufferEnd: 0
    });
    if (
      rest.bufferLength > 15 ||
      getState(ACTION.PROCESS).value() !== PROCESS.IDLE
    )
      return;
    console.log('restBuffer: ', rest);
    let segment = findSegment(playlist.segments, rest.bufferEnd);
    console.warn('current segment ', segment.id);
    dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADING);
    if (segment) {
      dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT, segment.id);
      connect(loadSegment)(segment);
    }
  }, 200);
  window.timer = timer;
}

const startTick = F.curry(tick);

export { startTick };

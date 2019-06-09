import { F } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from '../buffer/buffer-helper';
import { findSegment, loadSegment } from '../playlist/segment';
import { createMux } from '../mux/mux';
import { buffer } from '../buffer/buffer';
import media from '../media/media';
const { prop, compose, map } = F;

function tick({ getState, connect, dispatch }, playlist, mediaSource) {
  let timer = null;
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  mediaSource.duration = playlist.duration;
  connect(createMux);
  connect(buffer);

  timer = setInterval(() => {
    let rest = map(
      compose(
        connect(getBufferInfo),
        prop('seeking')
      )
    )(media).join();

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
      dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
      console.log('segment', getState(ACTION.PLAYLIST.CURRENT_SEGMENT));
      connect(loadSegment)(segment);
    }
  }, 200);
  window.timer = timer;
}

const startTick = F.curry(tick);

export { startTick };

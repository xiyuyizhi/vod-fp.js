import { F, Maybe } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from '../buffer/buffer-helper';
import { findSegment, loadSegment } from '../playlist/segment';
import { createMux } from '../mux/mux';
import { buffer } from '../buffer/buffer';
import { updateMediaDuration } from '../media/media';
const { prop, compose, map, curry } = F;

function tick({ getState, connect, dispatch }, level, mediaSource) {
  let timer = null;
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let loadSeg = connect(loadSegment);
  connect(updateMediaDuration)
  connect(createMux);
  connect(buffer);
  timer = setInterval(() => {

    let rest = map(
      compose(
        connect(getBufferInfo),
        prop('seeking')
      )
    )(media);

    Maybe.of(curry((bufferInfo, process, currentId) => {
      if (
        bufferInfo.bufferLength > 15 ||
        process !== PROCESS.IDLE ||
        media.value().ended
      ) {
        return
      }
      Maybe.of(curry((segment, currentId) => {
        if (currentId === segment.id) {
          segment = level.segments[currentId + 1]
          console.warn(`segment ${currentId} 已下载,下载下一分片`)
        }
        if (segment) {
          console.groupEnd()
          console.group('current segment ', segment.id);
          console.log('restBuffer: ', rest);
          dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADING);
          dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
          loadSeg(segment);
        }
      }))
        .ap(findSegment(level.segments, bufferInfo.bufferEnd))
        .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))

    }))
      .ap(rest)
      .ap(getState(ACTION.PROCESS))
      .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))


  }, 150);
  window.timer = timer;
}

const startTick = F.curry(tick);

export { startTick };

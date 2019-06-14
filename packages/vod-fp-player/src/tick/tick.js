import { F, Maybe, Success, Empty } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from '../buffer/buffer-helper';
import { findSegment, loadSegment } from '../playlist/segment';
import { createMux } from '../mux/mux';
import { buffer } from '../buffer/buffer';
import { updateMediaDuration } from '../media/media';

const { prop, compose, map, curry } = F;
const loadCheck = curry((bufferInfo, process, media) => {
  if (bufferInfo.bufferLength > 15 || process !== PROCESS.IDLE || media.ended) {
    return;
  }
  return bufferInfo;
});

function tick({ getState, connect, dispatch }, level, mediaSource) {
  connect(updateMediaDuration);
  connect(createMux);
  connect(buffer);

  let timer = null;
  let media = getState(ACTION.MEDIA.MEDIA_ELE);
  let findSegmentWithLevel = findSegment(level.segments);
  let loadSeg = connect(loadSegment);

  function startProcess(rest) {
    return Maybe.of(
      curry((segment, currentId) => {
        if (currentId === segment.id) {
          segment = level.segments[currentId + 1];
          console.warn(`segment ${currentId} 已下载,下载下一分片`);
        }
        return segment;
      })
    )
      .ap(findSegmentWithLevel(rest.bufferEnd))
      .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))
      .map(segment => {
        console.log(segment);
        console.groupEnd();
        console.group('current segment ', segment.id);
        console.log('restBuffer: ', rest);
        dispatch(ACTION.PROCESS, PROCESS.SEGMENT_LOADING);
        dispatch(ACTION.PLAYLIST.CURRENT_SEGMENT_ID, segment.id);
        loadSeg(segment);
        return true;
      })
      .getOrElse(Empty.of('no found segement'));
  }

  startProcess = curry(startProcess);

  timer = setInterval(() => {
    let rest = map(
      compose(
        connect(getBufferInfo),
        prop('seeking')
      )
    )(media);
    let process = getState(ACTION.PROCESS);
    Maybe.of(loadCheck)
      .ap(rest)
      .ap(process)
      .ap(media)
      .map(startProcess)
      .getOrElse(e => {
        console.log(e || 'continue check');
      });
  }, 200);

  window.timer = timer;
}

const startTick = F.curry(tick);

export { startTick };

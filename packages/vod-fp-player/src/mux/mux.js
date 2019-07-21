import work from 'webworkify-webpack';
import { TsToMp4 } from 'vod-fp-mux';
import { F, CusError } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { SEGMENT_ERROR } from '../error';
import { removeSegmentFromStore } from '../playlist/segment';

function createMux({ dispatch, connect }) {
  let worker = work(require.resolve('./worker.js'));
  let _doError = error => {
    connect(removeSegmentFromStore);
    dispatch(
      ACTION.ERROR,
      CusError.of(error).merge(
        CusError.of(SEGMENT_ERROR['SGEMENT_PARSE_ERROR'])
      )
    );
  };
  worker.addEventListener('message', e => {
    let { type, data } = e.data;
    if (type === 'data') {
      if (data.type === 'video') {
        dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, data);
        dispatch(ACTION.PROCESS, PROCESS.MUXED);
      }
      if (data.type === 'audio') {
        dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, data);
      }
    }
    if (type === 'error') {
      _doError(error);
    }
  });
  worker.addEventListener('error', e => {
    _doError(new Error(e.message));
    global.URL.revokeObjectURL(worker.objectURL);
  });
  dispatch(ACTION.MUX, worker);
}

function resetInitSegment({ getState }) {
  getState(ACTION.MUX).map(worker => {
    worker.postMessage({ type: 'resetInitSegment' });
  });
}

function setTimeOffset({ getState }, offset) {
  getState(ACTION.MUX).map(worker => {
    worker.postMessage({ type: 'setTimeOffset', data: offset });
  });
}

function _toMuxTs() {
  let lastSegment = null;

  return ({ getState, dispatch }, segment, buffer, sequeueNum, keyInfo) => {
    let worker = getState(ACTION.MUX).join();
    if (
      (lastSegment && lastSegment.cc !== segment.cc) ||
      (lastSegment && lastSegment.levelId !== segment.levelId)
    ) {
      worker.postMessage({ type: 'resetInitSegment' });
    }
    if (
      (lastSegment && lastSegment.cc !== segment.cc) ||
      (lastSegment && lastSegment.levelId !== segment.levelId) ||
      (lastSegment && Math.abs(segment.id - lastSegment.id) !== 1)
    ) {
      worker.postMessage({ type: 'setTimeOffset', data: segment.start });
    }
    dispatch(ACTION.PROCESS, PROCESS.MUXING);
    worker.postMessage(
      {
        type: 'push',
        data: {
          buffer,
          sequeueNum,
          keyInfo
        }
      },
      [buffer]
    );
    lastSegment = segment;
  };
}

function _toMuxFmp4({ dispatch }, buffer) {
  let { audioBuffer, videoBuffer } = buffer;
  dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, {
    buffer: videoBuffer.buffer,
    videoInfo: {
      codec: 'avc1.42c015'
      // fps: 25,
      // height: 206,
      // width: 480
    },
    combine: true
  });
  dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, {
    buffer: audioBuffer.buffer,
    audioInfo: {
      codec: 'mp4a.40.2',
      samplerate: 44100
    },
    combine: true
  });
  dispatch(ACTION.PROCESS, PROCESS.MUXED);
}

function toMux({ getState, connect }, segment, buffer, sequeueNum, keyInfo) {
  let format = getState(ACTION.PLAYLIST.FORMAT);
  if (format === 'ts') {
    connect(_toMuxTs)(segment, buffer.videoBuffer.buffer, sequeueNum, keyInfo);
  }
  if (format === 'fmp4') {
    connect(_toMuxFmp4)(buffer);
  }
}

resetInitSegment = F.curry(resetInitSegment);
setTimeOffset = F.curry(setTimeOffset);
createMux = F.curry(createMux);
_toMuxTs = F.curry(_toMuxTs());
_toMuxFmp4 = F.curry(_toMuxFmp4);
toMux = F.curry(toMux);

export { createMux, resetInitSegment, setTimeOffset, toMux };

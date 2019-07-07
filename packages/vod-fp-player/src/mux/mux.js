import { TsToMp4 } from 'vod-fp-mux';
import { F, CusError } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { SEGMENT_ERROR } from '../error';
import { removeSegmentFromStore } from '../playlist/segment';

function createMux({ dispatch, connect }) {
  let mux = new TsToMp4();
  mux
    .on('data', data => {
      if (data.type === 'video') {
        dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, data);
      }
      if (data.type === 'audio') {
        dispatch(ACTION.PROCESS, PROCESS.MUXED);
        dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, data);
      }
    })
    .on('error', e => {
      connect(removeSegmentFromStore);
      dispatch(
        ACTION.ERROR,
        CusError.of(e).merge(CusError.of(SEGMENT_ERROR['SGEMENT_PARSE_ERROR']))
      );
    });
  dispatch(ACTION.MUX, mux);
}

function resetInitSegment({ getState }) {
  getState(ACTION.MUX).map(mux => {
    mux.resetInitSegment();
  });
}

function setTimeOffset({ getState }, offset) {
  getState(ACTION.MUX).map(mux => {
    mux.setTimeOffset(offset);
  });
}

function _toMuxTs() {
  let lastSegment = null;

  return ({ getState, dispatch }, segment, buffer, sequeueNum, keyInfo) => {
    let mux = getState(ACTION.MUX).join();
    if (
      (lastSegment && lastSegment.cc !== segment.cc) ||
      (lastSegment && lastSegment.levelId !== segment.levelId)
    ) {
      mux.resetInitSegment();
    }
    if (
      (lastSegment && lastSegment.cc !== segment.cc) ||
      (lastSegment && lastSegment.levelId !== segment.levelId) ||
      (lastSegment && Math.abs(segment.id - lastSegment.id) !== 1)
    ) {
      mux.setTimeOffset(segment.start);
    }
    dispatch(ACTION.PROCESS, PROCESS.MUXING);
    mux.push(buffer, sequeueNum, keyInfo);
    mux.flush();
    lastSegment = segment;
  };
}

function _toMuxFmp4({ dispatch }, buffer) {
  let { audioBuffer, videoBuffer } = buffer;
  dispatch(ACTION.PROCESS, PROCESS.MUXED);
  dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, {
    buffer: videoBuffer,
    combine: true
  });
  dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, {
    buffer: audioBuffer,
    combine: true
  });
}

function toMux({ getState, connect }, segment, buffer, sequeueNum, keyInfo) {
  let format = getState(ACTION.PLAYLIST.FORMAT);
  if (format === 'ts') {
    connect(_toMuxTs)(segment, buffer.videoBuffer, sequeueNum, keyInfo);
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

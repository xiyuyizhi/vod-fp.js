import { TsToMp4 } from 'vod-fp-mux';
import { F, CusError } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { SEGMENT_ERROR } from '../error';

function createMux({ dispatch }) {
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

function toMuxTs() {
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
  }
}

resetInitSegment = F.curry(resetInitSegment);
setTimeOffset = F.curry(setTimeOffset);
createMux = F.curry(createMux);
toMuxTs = F.curry(toMuxTs())

export { createMux, resetInitSegment, setTimeOffset, toMuxTs };

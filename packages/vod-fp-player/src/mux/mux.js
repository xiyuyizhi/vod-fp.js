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

function toMux({ getState }, buffer, sequeueNum, keyInfo) {
  getState(ACTION.MUX).map(mux => {
    mux.push(buffer, sequeueNum, keyInfo);
    mux.flush();
  });
}
resetInitSegment = F.curry(resetInitSegment);
setTimeOffset = F.curry(setTimeOffset);
createMux = F.curry(createMux);
toMux = F.curry(toMux);

export { createMux, resetInitSegment, setTimeOffset, toMux };

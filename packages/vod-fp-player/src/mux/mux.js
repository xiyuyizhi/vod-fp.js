import { TsToMp4 } from 'vod-fp-mux';
import { F } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';

function createMux({ dispatch }) {
  let mux = new TsToMp4();
  mux
    .on('data', data => {
      if (data.type === 'video') {
        dispatch(ACTION.BUFFER.VIDEO_BUFFER, data);
      }
      if (data.type === 'audio') {
        dispatch(ACTION.PROCESS, PROCESS.MUXED);
        dispatch(ACTION.BUFFER.AUDIO_BUFFER, data);
      }
    })
    .on('error', e => {
      dispatch(ACTION.PROCESS, PROCESS.ERROR);
      dispatch(ACTION.EVENTS.ERROR, e);
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

function toMux({ getState }, buffer, id) {
  getState(ACTION.MUX).map(mux => {
    mux.push(buffer, id);
    mux.flush();
  });
}
resetInitSegment = F.curry(resetInitSegment);
setTimeOffset = F.curry(setTimeOffset);
createMux = F.curry(createMux);
toMux = F.curry(toMux);

export { createMux, resetInitSegment, setTimeOffset, toMux };

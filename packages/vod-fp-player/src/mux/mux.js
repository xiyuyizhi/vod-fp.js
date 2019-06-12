import { TsToMp4 } from 'vod-fp-mux';
import { F } from 'vod-fp-utility';
import { ACTION } from '../store';

function createMux({ dispatch }) {
  let mux = new TsToMp4();
  mux
    .on('data', data => {
      if (data.type === 'video') {
        dispatch(ACTION.BUFFER.VIDEO_BUFFER, data);
      }
      if (data.type === 'audio') {
        dispatch(ACTION.BUFFER.AUDIO_BUFFER, data);
      }
    })
    .on('done', () => {
      console.log('segment parse done');
    })
    .on('error', e => {
      console.error(e);
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

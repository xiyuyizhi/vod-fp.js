import { F } from 'vod-fp-utility';
import { PROCESS } from './index';

export default {
  module: 'FLVLIVE',
  ACTION: {
    INIT: 'init',
    WRITE_CHUNKS: 'writeChunks',
    READ_CHUNKS: 'readChunks',
    FLUSH_CHUNKS: 'flushChunks',
    REST_BUFFER: 'restBuffer',
    SET_READ_WATER_MARK: 'setReadWaterMark',
    END_OF_STREAM: 'endOfStream',
    ABORTABLE: 'abortAble'
  },
  getState() {
    return {
      writeWaterMark: 1024 * 1204 * 2,
      readWaterMark: 0,
      innerWriteBuffer: null,
      writeOffset: 0,
      abortAble: null,
      restBuffer: new Uint8Array(),
      derive: {
        init(state, _, { getConfig, ACTION }) {
          state.map(s => {
            s.innerWriteBuffer = new Uint8Array(s.writeWaterMark);
            s.readWaterMark = getConfig(ACTION.CONFIG.FLV_MUX_WATER_MARK);
          });
        },
        setReadWaterMark(state, waterMark) {
          state.map(s => (s.readWaterMark = waterMark));
        },
        writeChunks(state, chunks, { getState, dispatch, ACTION }) {
          state.map(s => {
            s.innerWriteBuffer.set(chunks, s.writeOffset);
            s.writeOffset += chunks.byteLength;

            let currentProcess = getState(ACTION.PROCESS).value();
            if (
              s.writeOffset > s.readWaterMark &&
              currentProcess === PROCESS.IDLE
            ) {
              // can custom some buffer
              let temp = s.innerWriteBuffer.slice(0, s.readWaterMark);
              let restNewBuffer = s.innerWriteBuffer.slice(
                s.readWaterMark,
                s.writeOffset
              );
              s.innerWriteBuffer.set(restNewBuffer, 0);
              s.innerWriteBuffer.fill(
                0,
                s.writeOffset - s.readWaterMark,
                s.writeOffset
              );
              s.writeOffset -= s.readWaterMark;
              dispatch(ACTION.FLVLIVE.READ_CHUNKS, {
                chunks: temp,
                remain: s.restBuffer
              });
            }
          });
        },
        flushChunks(state) {
          return state.map(s => {
            let flushed = s.innerWriteBuffer.slice(0, s.writeOffset);
            if (flushed.byteLength) {
              return flushed;
            }
          });
        }
      }
    };
  }
};

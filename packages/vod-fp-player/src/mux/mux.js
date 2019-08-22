import work from 'webworkify-webpack';
import {F, CusError, Logger} from 'vod-fp-utility';
import Mux from 'vod-fp-mux';
import {ACTION, PROCESS} from '../store';
import {SEGMENT_ERROR} from '../error';
import {removeSegmentFromStore} from '../playlist/segment';
import {findMp4Box, geneAvcCodec, geneMp4aCodec} from '../utils/index';
import {isFlv} from "../utils/probe"
import WorkerSimulate from './inline';

const logger = new Logger('player');
const {Mp4Stringify} = Mux;
const VIDEO_CODEC_PATH = [
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'stsd',
  'avc1',
  'avcC'
];
const VIDEO_TKHD_PATH = ['moov', 'trak', 'tkhd'];
const AUDIO_MVHD_PATH = [
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'stsd',
  'mp4a'
];

function muxBootstrap({dispatch, connect, getConfig}) {
  let worker;
  if (getConfig(ACTION.CONFIG.WORKER_ENABLE)) {
    worker = work(require.resolve('./worker.js'));
  } else {
    worker = new WorkerSimulate();
  }
  let _doError = error => {
    connect(removeSegmentFromStore);
    dispatch(ACTION.ERROR, CusError.of(error).merge(CusError.of(SEGMENT_ERROR['SGEMENT_PARSE_ERROR'])));
  };
  worker.addEventListener('message', e => {
    let {type, data} = e.data;
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
      _doError(data);
    }
  });
  worker.addEventListener('error', e => {
    _doError(new Error(e.message));
    if (worker.objectURL) {
      global
        .URL
        .revokeObjectURL(worker.objectURL);
    }
  });
  dispatch(ACTION.MUX, worker);
}

function resetInitSegment({getState}) {
  getState(ACTION.MUX).map(worker => {
    worker.postMessage({type: 'resetInitSegment'});
  });
}

function setTimeOffset({
  getState
}, offset) {
  getState(ACTION.MUX).map(worker => {
    worker.postMessage({type: 'setTimeOffset', data: offset});
  });
}

function _toMuxTs() {
  let lastSegment = null;
  let hasDetectFormat = false;
  return ({
    getState,
    dispatch
  }, segment, buffer, sequeueNum, keyInfo) => {
    let worker = getState(ACTION.MUX).join();
    if (!hasDetectFormat) {
      hasDetectFormat = true;
      let flv = isFlv(new Uint8Array(buffer, 0, 4));
      worker.postMessage({
        type: 'selectDemuxer',
        data: flv
          ? 'flv'
          : 'ts'
      })
    }
    if (!lastSegment) {
      worker.postMessage({type: 'resetInitSegment'});
      worker.postMessage({type: 'setTimeOffset', data: segment.start});
    }
    if (lastSegment && (lastSegment.levelId !== segment.levelId || lastSegment.cc !== segment.cc)) {
      worker.postMessage({type: 'resetInitSegment'});
      worker.postMessage({type: 'setDisContinuity'});
      worker.postMessage({type: 'setTimeOffset', data: segment.start});
    }
    if (lastSegment && Math.abs(segment.id - lastSegment.id) !== 1) {
      worker.postMessage({type: 'setTimeOffset', data: segment.start});
    }

    dispatch(ACTION.PROCESS, PROCESS.MUXING);

    worker.postMessage({
      type: 'push',
      data: {
        buffer,
        sequeueNum,
        keyInfo
      }
    }, [buffer]);
    lastSegment = segment;
  };
}

function _toMuxFmp4({
  dispatch
}, buffer, initMp4) {
  let {audioBuffer, videoBuffer} = buffer;
  let videoInfo;
  let audioInfo;
  if (initMp4) {
    videoInfo = {
      codec: 'avc1.42c015'
    };
    audioInfo = {
      codec: 'mp4a.40.2'
    };
    let vParsed = Mp4Stringify(videoBuffer.buffer);
    let aParsed = Mp4Stringify(audioBuffer.buffer);
    let avcC = findMp4Box(vParsed, VIDEO_CODEC_PATH);
    let tkhd = findMp4Box(vParsed, VIDEO_TKHD_PATH);
    let mp4a = findMp4Box(aParsed, AUDIO_MVHD_PATH);
    if (avcC && avcC.data) {
      videoInfo.codec = geneAvcCodec(avcC.data.sps[0]) || 'avc1.42c015';
      videoInfo.fps = '--';
    }
    if (mp4a && mp4a.data) {
      audioInfo.codec = geneMp4aCodec(mp4a.data.codecConfigLength) || 'mp4a.40.2';
      audioInfo.samplerate = mp4a.data.samplerate;
    }
    if (tkhd && tkhd.data) {
      videoInfo.width = tkhd.data.width;
      videoInfo.height = tkhd.data.height;
    }
  }
  dispatch(ACTION.BUFFER.VIDEO_BUFFER_INFO, {
    buffer: videoBuffer.buffer,
    videoInfo,
    combine: true
  });
  dispatch(ACTION.BUFFER.AUDIO_BUFFER_INFO, {
    buffer: audioBuffer.buffer,
    audioInfo,
    combine: true
  });
  dispatch(ACTION.PROCESS, PROCESS.MUXED);
}

function toMux({
  getState,
  connect
}, segment, buffer, sequeueNum, keyInfo, initMp4) {
  let format = getState(ACTION.PLAYLIST.FORMAT);
  if (format === 'ts') {
    connect(_toMuxTs)(segment, buffer.videoBuffer.buffer, sequeueNum, keyInfo);
  }
  if (format === 'fmp4') {
    connect(_toMuxFmp4)(buffer, initMp4);
  }
}

resetInitSegment = F.curry(resetInitSegment);
setTimeOffset = F.curry(setTimeOffset);
muxBootstrap = F.curry(muxBootstrap);
_toMuxTs = F.curry(_toMuxTs());
_toMuxFmp4 = F.curry(_toMuxFmp4);
toMux = F.curry(toMux);

export {muxBootstrap, resetInitSegment, setTimeOffset, toMux};

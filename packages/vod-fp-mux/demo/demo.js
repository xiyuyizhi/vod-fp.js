import { logger } from '../src/utils/logger';
import { TsMux, Mp4Parser } from '../src';
import parser from './m3u8-parser';

logger.log('%c mux start!', 'background: #222; color: #bada55');

let videoMedia = document.querySelector('#video');

window.serializeBuffer = () => {
  const buffered = videoMedia.buffered;
  if (!buffered.length) return [];
  let arr = [];
  for (let i = 0; i < buffered.length; i++) {
    arr.push([buffered.start(i), buffered.end(i)]);
  }
  return arr;
};

function getPlayList(m3u8Url) {
  return fetch(m3u8Url)
    .then(res => res.text())
    .then(res => {
      let playlist = parser(res);
      logger.log(playlist);
      if (playlist.error) {
        logger.error('error:', playlist.msg);
      }
      return playlist;
    });
}

function getStream(url) {
  return fetch(url).then(res => res.arrayBuffer());
}

let mediaSource;
let videoBuffer;
let audioBuffer;
const PROCESS_STATE = {
  MUXING: 'MUXING',
  IDLE: 'IDLE',
  APPENDING: 'APPENDING'
};

function convertStrToBuffer(str) {
  return new Uint8Array(str.split('').map(x => x.charCodeAt(0)));
}

function convertBufferToStr(buffer) {
  let temp = [];
  buffer.forEach(b => {
    temp.push(String.fromCharCode(b));
  });
  return temp.join('');
}

function attachMedia() {
  mediaSource = new window.MediaSource();
  window.mediaSource = mediaSource;
  mediaSource.addEventListener('sourceopen', onSourceOpen);
  videoMedia.src = URL.createObjectURL(mediaSource);
  videoMedia.addEventListener('waiting', e => {
    e.target.currentTime += 0.01;
  });
}
let videoPending = [];
let audioPending = [];

function onSourceOpen() {
  logger.log('readyState:', mediaSource.readyState);
  if (videoBuffer) return;
  videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  audioBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="mp4a.40.2"');
  videoBuffer.addEventListener('updateend', function(_) {
    logger.log('video buffer update end');
    if (videoPending.length) {
      videoBuffer.appendBuffer(videoPending.shift());
    } else if (
      !videoPending.length &&
      !audioPending.length &&
      !audioBuffer.updating &&
      !videoBuffer.updating
    ) {
      mediaSource.endOfStream();
    }
  });

  audioBuffer.addEventListener('updateend', function(_) {
    logger.log('audio buffer update end');
    if (audioPending.length) {
      audioBuffer.appendBuffer(audioPending.shift());
    } else if (
      !videoPending.length &&
      !audioPending.length &&
      !audioBuffer.updating &&
      !videoBuffer.updating
    ) {
      mediaSource.endOfStream();
    }
  });
  videoBuffer.addEventListener('error', e => {
    logger.log(e);
  });
  audioBuffer.addEventListener('error', e => {
    logger.log(e);
  });
}

attachMedia();

TsMux.tsDemux.on('MUX_DATA', data => {
  if (!data.buffer.byteLength) return;
  if (!videoBuffer.updating && videoPending.length === 0) {
    if (data.type === 'video') {
      videoBuffer.appendBuffer(data.buffer);
    }
    if (data.type === 'audio') {
      audioBuffer.appendBuffer(data.buffer);
    }
  } else {
    // videoPending.push(data);
    // audioPending.push(buff[1]);
  }
});

function loadstream(segment) {
  loadstream.loading = true;
  getStream(segment.url).then(buffer => {
    loadstream.loading = false;
    segment.loaded = true;
    TsMux.tsDemux(buffer, segment.id);
  });
}

function getBufferedInfo() {
  const currentTime = videoMedia.currentTime;
  const buffered = serializeBuffer();
  const currentBuffered = buffered.filter(
    ([start, end]) => start <= currentTime && end > currentTime
  )[0];
  if (currentBuffered) {
    return currentBuffered[1] - currentTime;
  }
  return 0;
}

let startLoadId = 0;
let maxLoadCount = 0;
function startTimer(segments) {
  // return;
  setInterval(() => {
    let current = segments.filter(x => !x.loaded && x.id >= startLoadId)[0];
    if (
      current.id > maxLoadCount ||
      loadstream.loading ||
      getBufferedInfo() > 40
    )
      return;
    logger.log(`--------current segment ${current.id}-------------`);
    loadstream(current);
  }, 1000);
}

let url = localStorage.getItem('url');
if (url) {
  getPlayList(url).then(pl => {
    startTimer(pl.segments);
  });
}
document.querySelector('#url').addEventListener('change', e => {
  url = e.target.value;
  localStorage.setItem('url', url);
});
document.querySelector('#load').addEventListener('click', e => {
  if (!url) return;
  if (videoBuffer.buffered.length) {
    videoBuffer.remove(0, Infinity);
  }
  getPlayList(url).then(pl => {
    startTimer(pl.segments);
  });
});

//-------------mp4 parse------------

const localBfStr = localStorage.getItem('mp4');
if (localBfStr) {
  logger.log(Mp4Parser.parseMp4(convertStrToBuffer(localBfStr)));
}

document.querySelector('#mp4Upload').addEventListener('change', e => {
  const [file] = e.target.files;
  const reader = new FileReader();
  reader.onload = e => {
    const buffer = e.target.result;
    const bfStr = convertBufferToStr(new Uint8Array(buffer));
    localStorage.setItem('mp4', bfStr);
    logger.log(Mp4Parser.parseMp4(buffer));
  };
  reader.readAsArrayBuffer(file);
});

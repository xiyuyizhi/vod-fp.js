import mux from '../src/mux';
import parser from './m3u8-parser';
import './mp4-mux';
console.log('%c mux start!', 'background: #222; color: #bada55');

window.serializeBuffer = () => {
  const buffered = document.querySelector('video').buffered;
  if (!buffered.length) return;
  let arr = [];
  for (let i = 0; i < buffered.length; i++) {
    arr.push([buffered.start(i), buffered.end(i)]);
  }
  console.log(arr.map(x => `[${x.join(',')}]`).join('----'));
};

function getPlayList(m3u8Url) {
  return fetch(m3u8Url)
    .then(res => res.text())
    .then(res => {
      let playlist = parser(res);
      console.log(playlist);
      if (playlist.error) {
        console.error('error:', playlist.msg);
      }
      return playlist;
    });
}

function getStream(url) {
  return fetch(url).then(res => res.arrayBuffer());
}

let logger = {
  log: (...rest) => {
    console.log(...rest);
  },
  warn: (...rest) => {
    console.warn(...rest);
  },
  error: console.error.bind(console)
};

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

function converBufferToStr(buffer) {
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
  document.querySelector('#video').src = URL.createObjectURL(mediaSource);
  document.querySelector('video').addEventListener('waiting', e => {
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
  videoBuffer.addEventListener('updateend', function (_) {
    logger.log('video buffer update end');
    if (videoPending.length) {
      videoBuffer.appendBuffer(videoPending.shift());
    } else if (
      !videoPending.length
      && !audioPending.length
      && !audioBuffer.updating
      && !videoBuffer.updating
    ) {
      mediaSource.endOfStream();
    }
  });

  audioBuffer.addEventListener('updateend', function (_) {
    logger.log('audio buffer update end');
    if (audioPending.length) {
      audioBuffer.appendBuffer(audioPending.shift());
    } else if (
      !videoPending.length
      && !audioPending.length
      && !audioBuffer.updating
      && !videoBuffer.updating
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

mux.on('MUX_DATA', buff => {
  if (!buff.length) return;
  if (!videoBuffer.updating) {
    // const a = document.createElement('a');
    // a.href = URL.createObjectURL(new Blob([buff]))
    // a.download = 'tsTomp4_1.mp4'
    // a.click();
    videoBuffer.appendBuffer(buff[0]);
    audioBuffer.appendBuffer(buff[1]);
  } else {
    videoPending.push(buff[0]);
    audioPending.push(buff[1]);
  }
});

function loadstream(segment) {
  loadstream.loading = true;
  getStream(segment.url).then(buffer => {
    loadstream.loading = false;
    segment.loaded = true;
    mux(new Uint8Array(buffer), segment.id);
  });
}

let startLoadId = 0;
let maxLoadCount = 6;
function startTimer(segments) {
  // return;
  setInterval(() => {
    let current = segments.filter(x => !x.loaded && x.id >= startLoadId)[0];
    if (current.id > maxLoadCount || loadstream.loading) return;
    console.log(`--------current segment ${current.id}-------------`);
    loadstream(current);
  }, 100);
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

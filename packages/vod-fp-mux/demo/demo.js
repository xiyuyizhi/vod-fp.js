import mux from '../src/mux';
import parser from './m3u8-parser';
console.log('%c mux start!', 'background: #222; color: #bada55');

function getPlayList(m3u8Url) {
  return fetch(m3u8Url)
    .then(res => res.text())
    .then(res => {
      let playlist = parser(res, new URL(m3u8Url).origin);
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
}
let pending = [];

function onSourceOpen() {
  logger.log('readyState:', mediaSource.readyState);
  if (videoBuffer) return;
  videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  videoBuffer.addEventListener('updateend', function(_) {
    logger.log('buffer update end');
    if (pending.length) {
      videoBuffer.appendBuffer(pending.shift());
    } else {
      mediaSource.endOfStream();
    }
  });
  videoBuffer.addEventListener('error', e => {
    logger.log(e);
  });
}

attachMedia();

mux.on('MUX_DATA', buff => {
  if (!buff.length) return;
  if (!videoBuffer.updating) {
    videoBuffer.appendBuffer(buff);
  } else {
    pending.push(buff);
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

function startTimer(segments) {
  setInterval(() => {
    let current = segments.filter(x => !x.loaded)[0];
    if (current.id > 2 || loadstream.loading) return;
    loadstream(current);
  }, 100);
}

let url = localStorage.getItem('url');
if (url) {
  getPlayList(url).then(pl => {
    console.log(pl);
    startTimer(pl.segments);
  });
}
document.querySelector('#url').addEventListener('change', e => {
  url = e.target.value;
  localStorage.setItem('url', url);
});
document.querySelector('#load').addEventListener('click', e => {
  if (!url) return;
  getPlayList(url).then(pl => {
    console.log(pl);
    startTimer(pl.segments);
  });
});

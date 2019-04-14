import mux from '../src/mux';
import parser from './m3u8-parser';
console.log('%c mux start!', 'background: #222; color: #bada55');

const m3u8Url = `https://valipl-vip.cp31.ott.cibntv.net/697592E07F03D718B85622366/03000600005CADA9030A6E461BDD7F0440B1FC-C6F3-4839-B1F7-ECA7FD27FD25-1-114.m3u8?ccode=0502&duration=2671&expire=18000&psid=6fad2f287c4648686e4d72618b8cd935&ups_client_netip=68ee94e1&ups_ts=1555252011&ups_userid=1081877852&utid=2NqjFNAU4T8CAW%2FB3Q8Z7twU&vid=XNDEzMTk5NDI2OA&vkey=A8b27ccdb28f2e6f702cf0af04be8b877&sm=1&operate_type=1`;

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
    if (current.id > 10 || loadstream.loading) return;
    loadstream(current);
  }, 100);
}

getPlayList(m3u8Url).then(pl => {
  console.log(pl);
  startTimer(pl.segments);
});

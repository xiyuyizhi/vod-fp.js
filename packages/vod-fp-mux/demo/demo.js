import mux from '../src/mux';
import './m3u8-parser';
console.log('%c mux start!', 'background: #222; color: #bada55');

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

function onSourceOpen() {
  logger.log('readyState:', mediaSource.readyState);
  if (videoBuffer) return;
  videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  videoBuffer.addEventListener('updateend', function(_) {
    logger.log('buffer update end');
    mediaSource.endOfStream();
  });
  videoBuffer.addEventListener('error', e => {
    logger.log(e);
  });
}

document.querySelector('#upload').addEventListener('change', e => {
  const [file] = e.target.files;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    const buffer = new Uint8Array(e.target.result);
    let index = uploadSegmentsList();
    setLocal(`bfs_${index}`, converBufferToStr(buffer));
  };
  reader.readAsArrayBuffer(file);
});

function setLocal(key, val) {
  localStorage.setItem(key, val);
}

function getLocal(key) {
  return localStorage.getItem(key);
}

function uploadSegmentsList() {
  let segList = getLocal('segs');
  if (segList) {
    segList = segList.split('_');
    segList.push(segList.length + 1);
  } else {
    segList = ['1'];
  }
  setLocal('segs', segList.join('_'));
  return segList.length;
}

function getSegmentsList() {
  let segList = getLocal('segs');
  return segList ? segList.split('_') : [];
}

let loadedStatus = [];

function doAppend() {
  let currentHandleSegId = 0;
  function appendBuffer(buff) {
    setTimeout(() => {
      if (videoBuffer.updating) {
        appendBuffer(buff);
      } else {
        videoBuffer.appendBuffer(buff);
        loadedStatus[currentHandleSegId] = true;
        doAppend.state = PROCESS_STATE.IDLE;
      }
    }, 20);
  }

  mux.on('MUX_DATA', buff => {
    if (!videoBuffer.updating) {
      videoBuffer.appendBuffer(buff);
      loadedStatus[currentHandleSegId] = true;
      doAppend.state = PROCESS_STATE.IDLE;
    } else {
      appendBuffer(buff);
    }
  });

  let muxSegmentTimer = setInterval(() => {
    if (doAppend.state !== PROCESS_STATE.MUXING) {
      let segPlayList = getSegmentsList();
      let segId;
      for (let i of segPlayList) {
        if (!loadedStatus[i]) {
          segId = i;
          break;
        }
      }
      if (!segId) return;
      const localBf = getLocal(`bfs_${segId}`);
      if (!localBf) return;
      currentHandleSegId = segId;
      doAppend.state = PROCESS_STATE.MUXING;
      logger.log(
        `%c do mux on seg ${segId}`,
        'background: #222; color: #bada55'
      );
      mux(convertStrToBuffer(localBf));
    }
  }, 100);
}

attachMedia();
doAppend();

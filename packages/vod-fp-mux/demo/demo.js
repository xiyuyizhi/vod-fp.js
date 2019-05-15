import { logger } from '../src/utils/logger';
import { TsToMp4, Mp4Parser } from '../src';
import parser from './m3u8-parser';
import { rejects } from 'assert';
import { resolve } from 'upath';

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
      window.pl = playlist;
      if (playlist.error) {
        logger.error('error:', playlist.msg);
      }
      return playlist;
    });
}

function getStream(url) {
  let resolve;
  let reject;
  let inner = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  fetch(url).then(res => resolve(res.arrayBuffer()), err => reject(err));
  inner.cancel = function() {
    resolve('cancel');
  };
  return inner;
}

let mediaSource;
let videoBuffer;
let audioBuffer;

let currentSegment;
let pendingRequest;
let processStatus = 'IDLE';

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
  videoMedia.addEventListener('seeking', () => {
    window.seek = true;
  });
  video.addEventListener('seeked', () => {
    window.seek = false;
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
    processStatus = 'IDLE';
    logger.log('video buffer update end');
    if (videoPending.length) {
      videoBuffer.appendBuffer(videoPending.shift());
    } else if (
      !videoPending.length &&
      !audioPending.length &&
      !audioBuffer.updating &&
      !videoBuffer.updating
    ) {
      // mediaSource.endOfStream();
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

let tsToMp4 = new TsToMp4();

tsToMp4
  .on('data', data => {
    if (!data.buffer.byteLength) return;
    if (!videoBuffer.updating && videoPending.length === 0) {
      if (data.type === 'video') {
        videoBuffer.appendBuffer(data.buffer);
      } else {
        audioBuffer.appendBuffer(data.buffer);
      }
    } else {
      if (data.type === 'video') {
        videoPending.push(data.buffer);
      } else {
        audioPending.push(data.buffer);
      }
    }
  })
  .on('done', () => {
    console.log('segment parse done');
  })
  .on('error', e => {
    console.log(e);
  });

function getSegment() {
  function binarySearch(list, start, end, point) {
    // start mid end
    const mid = start + Math.floor((end - start) / 2);
    if (list[mid].start < point && list[mid].end < point) {
      start = mid;
      return binarySearch(list, start, end, point);
    } else if (list[mid].start > point && list[mid].end > point) {
      end = mid;
      return binarySearch(list, start, end, point);
    } else {
      return list[mid];
    }
    return -1;
  }
  return binarySearch(
    pl.segments,
    0,
    pl.segments.length - 1,
    videoMedia.currentTime
  );
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
let maxLoadCount = 3;

function startTimer(segments, duration) {
  // return;
  console.log(duration);
  if (mediaSource.readyState === 'open') {
    mediaSource.duration = duration;
  }
  setInterval(() => {
    let current;
    if (processStatus !== 'IDLE') return;
    if (window.seek) {
      current = getSegment();
      tsToMp4.setTimeOffset(current.start);
    } else {
      current = segments.filter(x => {
        return !x.loaded && (currentSegment ? x.id > currentSegment.id : true);
      })[0];
      if (
        (pendingRequest && pendingRequest.loading) ||
        getBufferedInfo() > 30
      ) {
        return;
      }
    }
    logger.log(`--------current segment ${current.id}-------------`);
    processStatus = 'LOADING';
    pendingRequest = getStream(current.url);
    pendingRequest.then(buffer => {
      if (buffer === 'cancel') {
        console.log('cancel request....');
        return;
      }
      processStatus = 'LOADED';
      current.loaded = true;
      tsToMp4.push(buffer, current.id);
      tsToMp4.flush();
      currentSegment = current;
    });
  }, 1000);
}

let url = localStorage.getItem('url');
if (url) {
  setTimeout(() => {
    getPlayList(url).then(pl => {
      startTimer(pl.segments, pl.duration);
    });
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
    startTimer(pl.segments, pl.duration);
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

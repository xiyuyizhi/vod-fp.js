import Logger from '../src/utils/logger';
import {TsToMp4, Mp4Parser} from '../src';
import parser from './m3u8-parser';

let logger = new Logger('demo')
logger.log('%c mux start!', 'background: #222; color: #bada55');

let videoMedia = document.querySelector('#video');

window.serializeBuffer = () => {
  const buffered = videoMedia.buffered;
  if (!buffered.length) 
    return [];
  let arr = [];
  for (let i = 0; i < buffered.length; i++) {
    arr.push([
      buffered.start(i),
      buffered.end(i)
    ]);
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
  inner.cancel = function () {
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
  bindEvent()
}

function bindEvent() {
  videoMedia.addEventListener('waiting', e => {
    e.target.currentTime += 0.01;
  });
  videoMedia.addEventListener('seeking', () => {
    window.seek = true;
    logger.log('start seek...', videoMedia.currentTime)
  });
  videoMedia.addEventListener('seeked', () => {
    window.seek = false;
    logger.log('seek end , can play')
  });
  videoMedia.addEventListener('waiting', () => {
    videoMedia.currentTime += 0.1;
  })
}

let videoPending = [];
let audioPending = [];

function onSourceOpen() {
  logger.log('readyState:', mediaSource.readyState);
  if (videoBuffer) 
    return;
  videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  audioBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="mp4a.40.2"');

  videoBuffer.addEventListener('updateend', function (_) {
    logger.log('video buffer update end');
    currentSegment.videoAppend = true;
    updateSegmentsBoundAfterAppended()
    if (videoPending.length) {
      videoBuffer.appendBuffer(videoPending.shift());
    } else if (!videoPending.length && !audioPending.length && !audioBuffer.updating && !videoBuffer.updating) {
      // mediaSource.endOfStream();
    }
  });

  audioBuffer.addEventListener('updateend', function (_) {
    logger.log('audio buffer update end');
    currentSegment.audioAppend = true;
    updateSegmentsBoundAfterAppended()
    if (audioPending.length) {
      audioBuffer.appendBuffer(audioPending.shift());
    } else if (!videoPending.length && !audioPending.length && !audioBuffer.updating && !videoBuffer.updating) {
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

function updateSegmentsBoundAfterAppended() {
  if (currentSegment.videoAppend && currentSegment.audioAppend) {
    let start = Math.min(lastVideoInfo.startPTS, lastAudioInfo.startPTS)
    start = start / 90000;
    let end = Math.min(lastVideoInfo.endPTS, lastAudioInfo.endPTS);
    end = end / 90000;
    logger.log([
      start, end
    ], serializeBuffer().map(x => x[0] + '-' + x[1]).join(' ~ '));
    let id = currentSegment.id;
    currentSegment.start = start;
    currentSegment.end = parseFloat(end.toFixed(6));
    currentSegment.duration = end - start;
    let segs = pl.segments
    let len = segs.length - 1;
    for (let i = id + 1; i <= len; i++) {
      segs[i].start = segs[i - 1].end;
      segs[i].end = segs[i].start + segs[i].duration;
    }
    processStatus = 'IDLE';
  }
}

attachMedia();

let tsToMp4 = new TsToMp4();
let lastVideoInfo = null;
let lastAudioInfo = null;

tsToMp4.on('data', data => {
  logger.log(data)
  if (data.type === 'video') {
    lastVideoInfo = data;
  }
  if (data.type === 'audio') {
    lastAudioInfo = data;
  }
  if (!data.buffer.byteLength) 
    return;
  
  if (!videoBuffer.updating && data.type == 'video') {
    videoBuffer.appendBuffer(data.buffer);
  }

  if (!audioBuffer.updating && data.type == 'audio') {
    audioBuffer.appendBuffer(data.buffer);
  }
}).on('done', () => {
  logger.log('segment parse done');
}).on('error', e => {
  logger.log(e);
  //DELETE cuurent segment;
  if (processStatus === 'IDLE') 
    return;
  let id = currentSegment.id;
  pl
    .segments
    .splice(id, 1);
  for (let i = id; i < pl.segments.length; i++) {
    pl.segments[i].id -= 1;
    pl.segments[i].start = pl.segments[i - 1].end;
    pl.segments[i].end = pl.segments[i - 1].start + pl.segments[i - 1].duration;
  }
  // update duration;
  pl.duration = pl
    .segments
    .reduce((all, c) => {
      all += c.duration;
      return all;
    }, 0)
  mediaSource.duration = pl.duration;
  processStatus = 'IDLE';
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
  return binarySearch(pl.segments, 0, pl.segments.length - 1, videoMedia.currentTime);
}

function getBufferedInfo() {
  const currentTime = videoMedia.currentTime;
  const buffered = serializeBuffer();
  const currentBuffered = buffered.filter(([start, end]) => start <= currentTime && end > currentTime)[0];
  if (currentBuffered) {
    return currentBuffered[1] - currentTime;
  }
  return 0;
}

let startLoadId = 0;
let maxLoadCount = 0;

function startTimer(segments, duration) {
  if (mediaSource.readyState === 'open' && duration) {
    mediaSource.duration = duration;
  }
  clearInterval(window.timer)
  window.timer = setInterval(() => {
    let current;
    if (processStatus !== 'IDLE') 
      return;
    processStatus = 'LOADING';
    if (window.seek) {
      current = getSegment();
      logger.log('seek to segment ', current.id, [current.start, current.end])
      if (current.loaded) {
        current = pl.segments[current.id + 1];
      }
    } else {
      current = segments.filter(x => {
        return !x.loaded && (currentSegment
          ? x.id > currentSegment.id
          : true);
      })[0];
      if ((pendingRequest && pendingRequest.loading) || getBufferedInfo() > 30) {
        processStatus = 'IDLE';
        return;
      }
    }
    if ((currentSegment && current.cc !== currentSegment.cc) || window.seek) {
      tsToMp4.setTimeOffset(current.start);
    }
    logger.groupEnd()
    logger.group(`--------current segment ${current.id}  ${processStatus}-------------`);
    pendingRequest = getStream(current.url);
    pendingRequest.then(buffer => {
      if (buffer === 'cancel') {
        console.log('cancel request....');
        processStatus = 'IDLE';
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

window.clean = () => {
  clearInterval(window.timer)
}

let url = localStorage.getItem('url');
if (url) {
  setTimeout(() => {
    getPlayList(url).then(pl => {
      startTimer(pl.segments, pl.duration);
    });
  });
}

document
  .querySelector('#url')
  .addEventListener('change', e => {
    url = e.target.value;
    localStorage.setItem('url', url);
  });
document
  .querySelector('#load')
  .addEventListener('click', e => {
    if (!url) 
      return;
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

document
  .querySelector('#mp4Upload')
  .addEventListener('change', e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const buffer = e.target.result;
      const bfStr = convertBufferToStr(new Uint8Array(buffer));
      localStorage.setItem('mp4', bfStr);
      logger.log(Mp4Parser.parseMp4(buffer));
    };
    reader.readAsArrayBuffer(file);
  });
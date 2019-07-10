import { Logger } from 'vod-fp-utility';
import Vod from 'vod-fp-player';
import * as Mp4Parser from '../src/mp4-parser';
import parseFlv from '../src/flv-parser';

Logger.use(['mux', 'player']);

let logger = new Logger('mux');

const vod = new Vod();
vod.attachMedia(document.querySelector('video'));

let url;

if (location.search) {
  url = location.search;
  url = url.replace('?url=', '');
}
vod.loadSource(url);

//-------------mp4 parse------------

function convertStrToBuffer(str) {
  let len = str.length;
  let buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = str.charCodeAt(i);
  }
  return buffer;
}

function convertBufferToStr(buffer) {
  let len = buffer.byteLength;
  let str = '';
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  return str;
}

const localMp4 = localStorage.getItem('mp4');
if (localMp4) {
  logger.log(Mp4Parser.parseMp4(convertStrToBuffer(localMp4)));
}
const localFlv = localStorage.getItem('flv');
if (localFlv) {
  logger.log(parseFlv(convertStrToBuffer(localFlv)));
}

let todo = {
  flv: (str, buffer) => {
    localStorage.setItem('flv', str);
    logger.log(parseFlv(buffer));
  },
  mp4: (str, buffer) => {
    localStorage.setItem('mp4', str);
    logger.log(Mp4Parser.parseMp4(buffer));
  }
};

let changeHandler = (type, e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const buffer = e.target.result;
    const bfStr = convertBufferToStr(new Uint8Array(buffer));
    todo[type](bfStr, buffer);
  };
  reader.readAsArrayBuffer(file);
};

document
  .querySelector('#mp4Upload')
  .addEventListener('change', changeHandler.bind(null, 'mp4'));
document
  .querySelector('#flvUpload')
  .addEventListener('change', changeHandler.bind(null, 'flv'));

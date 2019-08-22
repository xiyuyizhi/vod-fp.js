import {Logger} from 'vod-fp-utility';
import Vod from 'vod-fp-player';
import Mp4Stringify from '../src/stringify/Mp4Stringify';
import FlvStream from "../src/transmux/FlvToMp4"

Logger.use(['mux', 'player']);

let logger = new Logger('mux');
let flvStream = new FlvStream();

flvStream.on('error', e => console.log(e))
flvStream.on('data', e => console.log(e))

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
  logger.log(Mp4Stringify(convertStrToBuffer(localMp4)));
}
const localFlv = localStorage.getItem('flv');
if (localFlv) {
  logger.log(flvStream.push(convertStrToBuffer(localFlv)));
  flvStream.flush()
}

let todo = {
  flv: (str, buffer) => {
    localStorage.setItem('flv', str);
    logger.log(flvStream.push(buffer));
    flvStream.flush()
  },
  mp4: (str, buffer) => {
    localStorage.setItem('mp4', str);
    logger.log(Mp4Stringify(buffer));
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

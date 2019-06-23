import { Logger } from 'vod-fp-utility';
import Vod from 'vod-fp-player';

Logger.use(['mux', 'player']);

const vod = new Vod();
vod.attachMedia(document.querySelector('video'));

let url;

if (location.search) {
  url = location.search;
  url = url.replace('?url=', '');
}
vod.loadSource(url);

//-------------mp4 parse------------

const localBfStr = localStorage.getItem('mp4');
if (localBfStr) {
  logger.log(Mp4Parser.parseMp4(convertStrToBuffer(localBfStr)));
}

document.querySelector('#mp4Upload').addEventListener('change', e => {
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

import { Logger } from 'vod-fp-utility';
import Vod from '../src';

// Logger.use(['base', 'mux', 'player']);
Logger.use(['base', 'player']);

console.log('%c player start', 'background: #222; color: #bada55');

document.addEventListener('keyup', e => {
  if (e.keyCode === 38) {
    document.querySelector('video').currentTime += 2;
  }
});

let url;
let vod;
if (location.search) {
  url = location.search;
  url = url.replace('?url=', '');
}

function initPlayer(url) {
  vod = new Vod({
    maxBufferLength: 30,
    maxFlyBufferLength: 60
  });
  vod.attachMedia(document.querySelector('video'));
  vod.loadSource(
    // 'http://localhost:8880/12/index.m3u8'
    // 'http://localhost:8880/8/fmp4.m3u8'
    url
  );
  vod.useDebug(document.querySelector('#player'));
  vod.on(Vod.Events.ERROR, e => {
    console.log(e);
  });
  vod.on(Vod.Events.MANIFEST_LOADED, pl => {
    // 创建清晰度选项
    const { levels } = pl;
    if (levels.length > 1) {
      let select = document.createElement('select');
      let selectHtml;
      select.className = 'resolutionList';
      select.style.display = 'block';
      selectHtml = levels
        .filter(x => x.resolution || x.streamtype)
        .map(
          ({ levelId, streamtype, resolution }) =>
            `<option value='${levelId}'>${resolution || streamtype}</option>`
        )
        .join('\n');
      select.innerHTML = selectHtml;
      select.addEventListener('change', e => {
        vod.changeLevel(e.target.value);
      });
      document.body.appendChild(select);
    }
  });

  vod.on(Vod.Events.LEVEL_CHANGED, levelId => {
    console.log('level changed to ', levelId);
  });
  vod.on(Vod.Events.LEVEL_CHANGED_ERROR, levelId => {
    console.log('level changed error ', levelId);
  });
}

initPlayer(url);

setTimeout(() => {
  return;
  vod.destroy();
  initPlayer(url);
}, 1000);

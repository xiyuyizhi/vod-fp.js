import Vod from '../src';

console.log('%c player start', 'background: #222; color: #bada55');

const vod = new Vod();
vod.attachMedia(document.querySelector('video'));

let url;

if (location.search) {
  url = location.search;
  url = url.replace('?url=', '');
}
vod.loadSource(
  // 'http://localhost:8880/81/index.m3u8'
  'http://localhost:8880/8/fmp4.m3u8'
  // url
);
vod.on(Vod.Events.ERROR, e => {
  console.log(e);
});
vod.on(Vod.Events.MANIFEST_LOADED, pl => {
  // 创建清晰度选项
  const { levels } = pl;
  if (levels.length > 1) {
    let select = document.createElement('select');
    let selectHtml;
    select.style.display = 'block';
    selectHtml = levels
      .map(
        ({ levelId, streamtype }) =>
          `<option value='${levelId}'>${streamtype}</option>`
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
  console.log('level changed to ' + levelId);
});

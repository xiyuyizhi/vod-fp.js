import Vod from '../src/index.js';

console.log('%c player start!', 'background: #222; color: #bada55');

window.Vod = Vod;
const vod = new Vod({ maxBufferLength: 100 });
vod.attachMedia(document.querySelector('video'));
vod.loadSource();

const vod1 = new Vod({ maxBufferLength: 100 });
vod1.attachMedia(document.querySelector('video'));
vod1.loadSource();

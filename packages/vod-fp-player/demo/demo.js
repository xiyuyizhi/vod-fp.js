import Vod from '../src/index.js';

console.log('%c player start!', 'background: #222; color: #bada55');

const vod = new Vod({maxBufferLength: 100});

vod.loadSource('url: https://youku.com/abc');

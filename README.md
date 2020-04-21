# vod-fp.js

## features

- [x] hls with ts format

- [x] hls with fmp4 format

- [x] hls ts with AES-128 decrypt

- [x] abr

- [x] hls ts live with abr

- [x] http-flv live

- [x] websocket flv live

## some notes

- [函数式+状态管理探索前端开发](./notes/statemanage_fp.md)

- 音视频记录

  - [ts](./notes/ts.md)

  - [h264](./notes/h264.md)

  - [mp4](./notes/mp4.md)

  - [flv](./notes/flv.md)

  - [drm](./notes/drm.md)

## base usage

#### used in browser direct

```javascript
<script src="https://cdn.jsdelivr.net/npm/vod-fp-player@latest/lib/vod-fp-player.min.js"></script>
```

#### used as module

```javascript
npm install vod-fp-player --save

import Vod from "vod-fp-player"

```

```javascript
const vod = new Vod({
  [Vod.Configs.MAX_BUFFER_LENGTH]: 60,
  [Vod.Configs.MAX_FLY_BUFFER_LENGTH]: 30,
});
const media = document.querySelector('video');

media.addEventListener('loadedmetadata', () => {
  media.play().catch((e) => {
    // not allowed auto play
  });
});

vod.attachMedia(media);

vod.loadSource('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');

vod.on(Vod.Events.ERROR, (e) => {
  // do someting when error occur
});
```

## usage details

- [vod-fp-player](./packages/vod-fp-player/README.md)

- [vod-fp-mux](./packages/vod-fp-mux/README.md)

- [vod-fp-utility](./packages/vod-fp-utility/README.md)

## development

[media asserts](https://github.com/xiyuyizhi/live-stream-test)

```javascript
git clone git@github.com:xiyuyizhi/vod-fp.js.git

npm install lerna -g

lerna bootstrap

npm run build:mux

npm run build:util

npm run build:player

npm run build:demo

npm run dev

npm run demo
```

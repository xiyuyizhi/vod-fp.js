# vod-fp.js

DOING...

## features

- [x] hls with ts format

- [x] hls with fmp4 format

- [x] hls ts with AES-128 decrypt

- [x] abr

- [x] hls ts live with abr

- [x] http-flv live

- [x] websocket flv live

## some notes

- [函数式+状态管理探索前端开发]

- 音视频记录

  - [ts](./notes/ts.md)

  - [h264](./notes/h264.md)

  - [mp4](./notes/mp4.md)

  - [drm](./notes/drm.md)

## base usage

```
npm install vod-fp-player --save

import Vod from "vod-fp-player"

```

```
const vod = new Vod({
  Vod.Configs.MAX_BUFFER_LENGTH:60,
  Vod.Configs.MAX_FLY_BUFFER_LENGTH:30,
  Vod.Configs.FLV_LIVE:false, // flv live
})

vod.attachMedia(document.querySelector('video'))

vod.loadSource('xxxx.m3u8')
vod.loadSource('xxxx.master.m3u8')
vod.loadSource('http live flv')
vod.loadSource('wss://xxxxx.flv')

vod.on(Vod.Events.ERROR,e => {
  // do someting when error occur
})

vod.on(Vod.Events.MANIFEST_LOADED,playlist => {
  // get the structured m3u8 playlist

})

vod.on(Vod.Events.LEVEL_CHANGED,levelId => {

})


.
.
.

```

## usage details

- [vod-fp-player](./packages/vod-fp-player/README.md)

- [vod-fp-mux](./packages/vod-fp-mux/README.md)

- [vod-fp-utility](./packages/vod-fp-utility/README.md)

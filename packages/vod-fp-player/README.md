# vod-fp-player

```javascript
npm install vod-fp-player --save

import Vod from "vod-fp-player"
```

## hls

```javascript
const vod = new Vod({
  Vod.Configs.MAX_BUFFER_LENGTH:60,
  Vod.Configs.MAX_FLY_BUFFER_LENGTH:30,
  Vod.Configs.SEGMENT_MAX_TIMEOUT:30 * 1000,
  Vod.Configs.MAX_LEVEL_RETRY_COUNT:4, // m3u8请求失败后重试次数
  Vod.Configs.REQUEST_RETRY_COUNT:2, // 单次请求m3u8、segment最大重试次数到 单次失败
  Vod.Configs.REQUEST_RETRY_DELAY:1000, // 重试间隔
  Vod.Configs.ABR_ENABLE:true, //启用abr
  Vod.Configs.WORKER_ENABLE:true, //启用worker执行mux操作
})

vod.attachMedia(document.querySelector('video'))

vod.loadSource('xxxx.m3u8')
vod.loadSource('xxxx.master.m3u8')


vod.on(Vod.Events.ERROR,e => {
  // do someting when error occur
})

vod.on(Vod.Events.MANIFEST_LOADED,playlist => {
  // get the structured m3u8 playlist

})

vod.on(Vod.Events.LEVEL_CHANGED,levelId => {

})

```

## flv live

```javascript
const vod = new Vod({
  Vod.Configs.FLV_LIVE:true,
  Vod.Configs.WORKER_ENABLE:true, //启用worker执行mux操作
  Vod.Configs.FLV_MUX_WATER_MARK:1024 * 300, // 300KB 请求buffer积攒到300KB后处理一次
  Vod.Configs.flyLiveMaxDelay:4, // 直播延迟 >4s后追帧
})

vod.attachMedia(document.querySelector('video'))

vod.loadSource('xxxx.flv')
vod.loadSource('wss://xxxx.flv')


vod.on(Vod.Events.ERROR,e => {
  // do someting when error occur
})

```

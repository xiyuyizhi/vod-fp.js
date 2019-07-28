# vod-fp.js

DOING...

## features

[x] hls with ts format

[x] hls with fmp4 format

[x] hls ts with AES-128 decrypt

[x] abr

[ ] fmp4 drm with widevine

[ ] hls live 、 with abr

[ ] http-flv live

## base usage

```
npm install vod-fp-player --save

import Vod from "vod-fp-player"

const vod = new Vod({
  maxBufferLength:60
})

vod.attachMedia(document.querySelector('video'))

vod.loadSource('m3u8 url')

vod.changeLevel(levelId)

vod.destroy()

vod.on(Vod.Events.ERROR,e => {
  // do someting when error occur
})

vod.on(Vod.Events.MANIFEST_LOADED,playlist => {
  // get the structured m3u8 playlist

})

vod.on(Vod.Events.DURATION_CHANGE,duration => {

})

.
.
.

```

## usage details

- vod-fp-utility

- vod-fp-mux

- vod-fp-player

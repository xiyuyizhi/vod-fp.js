# vod-fp-mux

> ts to mp4,flv to mp4 mux 模块

[online usage](https://demo.xiyuyizhi.xyz/onlineTool)

```javascript

npm install vod-fp-mux --save
import Mux from 'vod-fp-mux';

```

## ts to mp4

```javascript
const { TsToMp4 } = Mux;
```

```javascript
const tsToMp4 = new TsToMp4();

// bind event
tsToMp4.on('data', buffer => {});
tsToMp4.on('error', e => {});

/*
 * buffer: ts buffer信息
 * sequenceNumber: 分片序列id
 * keyInfo: // aes-128加密的ts的key信息
 *    {
 *      method:'AES-128',
 *      key:,// 16字节 arraybuffer or uint8array
 *      iv:,// 16进制字符串或uint8array
 *    }
 *
 * /
tsToMp4.push(buffer,sequenceNumber,keyInfo)
tsToMp4.flush()

首次处理或者level 改变时执行 tsToMp4.resetInitSegment()

存在不连续标记时执行 tsToMp4.setDisContinuity()

seek时执行 tsToMp4.setTimeOffset(offset) // offset 当前位置在timeline上偏移

```

```javascript
const { TsStringify } = Mux;
// demux ts 为对应的对象结构 ,使用方式如上
```

## flv to mp4

```javascript
const { FlvToMp4 } = Mux; //基本 api 同上,暂时执行 setDisContinuity()无效
const { FlvStringify } = Mux; //// demux Flv 为对应的对象结构
```

## mp4 parser

解析 MP4 buffer 为对应的 box 树形对象结构

```javascript
const { Mp4Stringify } = Mux;

let mp4Json = Mp4Stringify(buffer);
```

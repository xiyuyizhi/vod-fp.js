import { PipeLine } from 'vod-fp-utility';
import aesjs from 'aes-js';
import {
  TsPacketStream,
  TsPacketParseStream,
  TsElementaryStream
} from '../mpeg2-ts';
import { AacStream, AvcStream, MetaDataStream } from '../codecs';

export default class TsStringify extends PipeLine {
  constructor() {
    super();
    this.entryStream = null;
    this.audioStream = null;
    this.videoStream = null;
    this.setUpPipeLine();
  }

  push(buffer, sequenceNumber = 0, keyInfo = {}) {
    try {
      this.entryStream.push(buffer);
    } catch (e) {
      this.emit('error', e);
    }
  }

  flush() {
    try {
      this.entryStream.flush();
    } catch (e) {
      this.emit('error', e);
    }
  }

  bindEvent(eles, eventName) {
    eles.forEach(ele => {
      ele.on(eventName, data => {
        this.emit(eventName, data);
      });
    });
  }

  setUpPipeLine(options) {
    let es;
    let entryStream = new TsPacketStream();
    let tsPacketParseStream = new TsPacketParseStream();
    let tsElementaryStream = new TsElementaryStream();
    let metaDataStream = new MetaDataStream();
    let aacStream = new AacStream();
    let avcStream = new AvcStream();

    this.bindEvent(
      [
        entryStream,
        tsPacketParseStream,
        tsElementaryStream,
        metaDataStream,
        aacStream,
        avcStream
      ],
      'error'
    );
    this.entryStream = entryStream;
    es = this.entryStream.pipe(tsPacketParseStream).pipe(tsElementaryStream);
    this.audioStream = es.pipe(aacStream);
    this.videoStream = es.pipe(avcStream);

    this.bindEvent([this.videoStream, this.audioStream], 'data');
    this.bindEvent([this.videoStream, this.audioStream], 'done');
  }
}

import { PipeLine } from 'vod-fp-utility';
import aesjs from 'aes-js';
import {
  TsPacketStream,
  TsPacketParseStream,
  TsElementaryStream
} from '../mpeg2-ts';
import { AacStream, AvcStream, MetaDataStream } from '../codecs';
import { RemuxStream, VideoFragmentStream, AudioFragmentStream } from '../mp4';
import { INVALID_AES_128_KEY } from '../error';

export default class TsToMp4 extends PipeLine {
  constructor(options) {
    super();
    this.entryStream = null;
    this.audioStream = null;
    this.videoStream = null;
    this.remuxStream = null;
    this.setUpPipeLine(options);
  }

  resetInitSegment() {
    if (this.audioStream && this.videoStream) {
      this.audioStream.emit('resetInitSegment');
      this.videoStream.emit('resetInitSegment');
    }
  }

  setSequenceNumber(nb) {
    this.audioStream.emit('sequenceNumber', nb);
    this.videoStream.emit('sequenceNumber', nb);
  }

  setTimeOffset(offset) {
    this.remuxStream.emit('timeOffset', offset);
  }

  _createInitializationVector(segmentNumber) {
    let uint8View = new Uint8Array(16);

    for (let i = 12; i < 16; i++) {
      uint8View[i] = (segmentNumber >> (8 * (15 - i))) & 0xff;
    }
    return uint8View;
  }

  _getIv(iv, sequenceNumber) {
    if (iv) {
      if (iv.buffer) return iv;
      iv = iv.replace('0x', '');
      return iv.split(/\B(?=(?:.{2})+$)/g).map(x => parseInt(x, 16));
    }
    return this._createInitializationVector(sequenceNumber);
  }

  push(buffer, sequenceNumber = 0, keyInfo = {}) {
    try {
      this.setSequenceNumber(sequenceNumber);
      if (keyInfo && keyInfo.method === 'AES-128') {
        let { key, iv } = keyInfo;
        if (
          !(key instanceof ArrayBuffer || key instanceof Uint8Array) ||
          key.byteLength !== 16
        ) {
          this.emit('error', INVALID_AES_128_KEY);
          return;
        }
        let aesCbc = new aesjs.ModeOfOperation.cbc(
          new Uint8Array(key),
          this._getIv(iv, sequenceNumber)
        );
        this.entryStream.push(
          aesCbc.decrypt(
            buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
          )
        );
      } else {
        this.entryStream.push(buffer);
      }
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
    let remuxStream = new RemuxStream();
    let tsPacketParseStream = new TsPacketParseStream();
    let tsElementaryStream = new TsElementaryStream();
    let metaDataStream = new MetaDataStream();
    let aacStream = new AacStream();
    let avcStream = new AvcStream();
    let audioFragmentStream = new AudioFragmentStream();
    let videoFragmentStream = new VideoFragmentStream();

    this.bindEvent(
      [
        entryStream,
        remuxStream,
        tsPacketParseStream,
        tsElementaryStream,
        metaDataStream,
        aacStream,
        avcStream,
        audioFragmentStream,
        videoFragmentStream
      ],
      'error'
    );
    this.entryStream = entryStream;
    this.remuxStream = remuxStream;

    es = this.entryStream.pipe(tsPacketParseStream).pipe(tsElementaryStream);

    es.pipe(metaDataStream).pipe(remuxStream);

    this.audioStream = es
      .pipe(aacStream)
      .pipe(remuxStream)
      .pipe(audioFragmentStream);

    this.videoStream = es
      .pipe(avcStream)
      .pipe(remuxStream)
      .pipe(videoFragmentStream);
    this.bindEvent([this.videoStream, this.audioStream], 'data');
    this.bindEvent([this.videoStream, this.audioStream], 'done');
  }
}

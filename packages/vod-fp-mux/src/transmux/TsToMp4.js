import { PipeLine } from 'vod-fp-utility';
import {
  TsPacketStream,
  TsPacketParseStream,
  TsElementaryStream
} from '../mpeg2-ts';
import { AacStream, AvcStream, MetaDataStream } from '../codecs';
import { RemuxStream, VideoFragmentStream, AudioFragmentStream } from '../mp4';

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

  push(buffer, sequenceNumber = 0, offset = 0) {
    try {
      this.setSequenceNumber(sequenceNumber);
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

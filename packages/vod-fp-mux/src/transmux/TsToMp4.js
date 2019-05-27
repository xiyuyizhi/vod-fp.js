import {PipeLine} from "vod-fp-utility"
import {TsPacketStream, TsPacketParseStream, TsElementaryStream} from '../mpeg2-ts';
import {AacStream, AvcStream, MetaDataStream} from '../codecs';
import {RemuxStream, VideoFragmentStream, AudioFragmentStream} from '../mp4';

export default class TsToMp4 extends PipeLine {

  constructor(options) {
    super();
    this.entryStream = null;
    this.audioStream = null;
    this.videoStream = null;
    this.remuxStream = null;
    this.setUpPipeLine(options)
  }

  resetInitSegment() {
    if (this.audioStream && this.videoStream) {
      this
        .audioStream
        .emit('resetInitSegment')
      this
        .videoStream
        .emit('resetInitSegment')
    }
  }

  setSequenceNumber(nb) {
    this
      .audioStream
      .emit('sequenceNumber', nb)
    this
      .videoStream
      .emit('sequenceNumber', nb)
  }

  setTimeOffset(offset) {
    this
      .remuxStream
      .emit('timeOffset', offset)
  }

  push(buffer, sequenceNumber = 0, offset = 0) {
    this.setSequenceNumber(sequenceNumber)
    this
      .entryStream
      .push(buffer)
  }

  flush() {
    this
      .entryStream
      .flush()
  }

  setUpPipeLine(options) {
    let es;
    let remuxStream;
    this.entryStream = new TsPacketStream()
    const bindEvent = (target) => {
      target.on('data', data => {
        this.emit('data', data)
      })
      target.on('done', () => {
        this.emit('done')
      })
      target.on('error', e => {
        this.emit('error', e)
      })
    }
    this.remuxStream = remuxStream = new RemuxStream();
    es = this
      .entryStream
      .pipe(new TsPacketParseStream())
      .pipe(new TsElementaryStream());
    es
      .pipe(new MetaDataStream())
      .pipe(remuxStream);
    this.audioStream = es
      .pipe(new AacStream())
      .pipe(remuxStream)
      .pipe(new AudioFragmentStream())
    this.videoStream = es
      .pipe(new AvcStream())
      .pipe(remuxStream)
      .pipe(new VideoFragmentStream())
    bindEvent(this.audioStream)
    bindEvent(this.videoStream)
  }

}
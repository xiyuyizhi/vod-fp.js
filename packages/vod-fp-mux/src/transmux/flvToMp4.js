import {PipeLine} from 'vod-fp-utility';
import {
  FlvStream,
  FlvMetaDataStream,
  FlvTagStream,
  FlvVideoTagStream,
  FlvAudioTagStream,
  FlvDataTagStream
} from '../flv';
import {RemuxStream, AudioFragmentStream, VideoFragmentStream} from "../mp4"

export default class FlvToMp4 extends PipeLine {
  constructor(options) {
    super();
    this.setUpPipeLine(options);
  }

  resetInitSegment() {}

  setDisContinuity() {}

  setTimeOffset() {}

  push(buffer) {
    try {
      this
        .entryStream
        .push(buffer);
    } catch (e) {
      this.emit('error', e);
    }
  }

  flush() {
    try {
      this
        .entryStream
        .flush();
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
    let entryStream = new FlvStream();
    let flvTagStream = new FlvTagStream();
    let flvAudioTagStream = new FlvAudioTagStream();
    let flvVideoTagStream = new FlvVideoTagStream();
    let flvDataTagStream = new FlvDataTagStream();
    let flvMetaDataStream = new FlvMetaDataStream();
    let remuxStream = new RemuxStream();
    let audioFragmentStream = new AudioFragmentStream()
    let videoFragmentStream = new VideoFragmentStream()

    this.bindEvent([
      entryStream, flvTagStream, flvAudioTagStream, flvVideoTagStream, flvDataTagStream
    ], 'error');

    this.entryStream = entryStream;

    entryStream
      .pipe(flvMetaDataStream)
      .pipe(remuxStream);

    es = this
      .entryStream
      .pipe(flvTagStream)

    es
      .pipe(flvAudioTagStream)
      .pipe(remuxStream)
      .pipe(audioFragmentStream)

    es
      .pipe(flvVideoTagStream)
      .pipe(remuxStream)
      .pipe(videoFragmentStream)

    this.bindEvent([
      audioFragmentStream, videoFragmentStream
    ], 'data');
    this.bindEvent([
      audioFragmentStream, videoFragmentStream
    ], 'done');

  }
}

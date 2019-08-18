import {PipeLine} from 'vod-fp-utility';
import {FlvStream, FlvTagStream, FlvVideoTagStream, FlvAudioTagStream, FlvDataTagStream} from '../flv';

export default class FlvToMp4 extends PipeLine {
  constructor(options) {
    super();
    this.setUpPipeLine(options);
  }

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
    this.bindEvent([
      entryStream, flvTagStream, flvAudioTagStream, flvVideoTagStream, flvDataTagStream
    ], 'error');

    this.entryStream = entryStream;

    es = this
      .entryStream
      .pipe(flvTagStream)

    es.pipe(flvAudioTagStream)
    es.pipe(flvVideoTagStream)
    es.pipe(flvDataTagStream)

    this.bindEvent([
      flvAudioTagStream, flvVideoTagStream
    ], 'data');
    this.bindEvent([
      flvAudioTagStream, flvVideoTagStream
    ], 'done');

  }
}

import {
  TsPacketStream,
  TsPacketParseStream,
  TsElementaryStream
} from '../mpeg2-ts';
import { AacStream, AvcStream, MetaDataStream } from '../codecs';
import { RemuxStream, VideoFragmentStream, AudioFragmentStream } from '../mp4';

function tsDemux(buffer) {
  input.push(buffer);
  input.flush();
}

const input = new TsPacketStream();
const remuxStream = new RemuxStream();
const es = input.pipe(new TsPacketParseStream()).pipe(new TsElementaryStream());
es.pipe(new MetaDataStream()).pipe(remuxStream);

es.pipe(new AacStream())
  .pipe(remuxStream)
  .pipe(new AudioFragmentStream())
  .on('data', data => {
    tsDemux.emit('MUX_DATA', data);
  });

es.pipe(new AvcStream())
  .pipe(remuxStream)
  .pipe(new VideoFragmentStream())
  .on('data', data => {
    tsDemux.emit('MUX_DATA', data);
  });

tsDemux.eventBus = {};

tsDemux.on = (event, listener) => {
  if (tsDemux.eventBus[event]) {
    tsDemux.eventBus[event].push(listener);
  } else {
    tsDemux.eventBus[event] = [listener];
  }
};

tsDemux.emit = (event, data) => {
  let listeners = tsDemux.eventBus[event];
  listeners.forEach(listener => {
    listener(data);
  });
};

export { tsDemux };

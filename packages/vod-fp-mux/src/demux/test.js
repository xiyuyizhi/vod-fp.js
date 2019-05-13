import {
  TsPacketStream,
  TsPacketParseStream,
  TsElementaryStream
} from '../mpeg2-ts';

import { AacAtream, AvcStream } from '../codecs';

const input = new TsPacketStream();

const es = input.pipe(new TsPacketParseStream()).pipe(new TsElementaryStream());

es.pipe(new AvcStream()).on('data', data => {
  console.log(data);
});
es.pipe(new AacAtream()).on('data', data => {
  console.log(data);
});

function tsDemux(buffer) {
  input.push(buffer);
  input.flush();
}
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

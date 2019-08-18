import TsToMp4 from './transmux/TsToMp4';
import FlvToMp4 from './transmux/FlvToMp4';
import TsStringify from './stringify/TsStringify';
import FlvStringify from './stringify/FlvStringify';
import Mp4Stringify from './stringify/Mp4Stringify';
import * as Probe from './utils/probe';

const Mux = {
  TsToMp4,
  FlvToMp4,
  TsStringify,
  FlvStringify,
  Mp4Stringify,
  Probe
};

export default Mux;

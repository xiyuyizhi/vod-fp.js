import TsToMp4 from './transmux/TsToMp4';
import * as Mp4Parser from './mp4-parser';
import TsStringify from './stringify/TsStringify';
import * as Probe from './utils/probe';

const Mux = { TsToMp4, Mp4Parser, TsStringify, Probe };

export default Mux;

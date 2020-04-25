/**
 * BOX
 * ftyp
 * moov
 *    mvhd
 *    trak
 *        tkhd
 *        mdia  track media box
 *            mdhd
 *            hdlr  handler reference box [video | sound | hint | ...]
 *            minf  // media info box
 *                vmhd
 *                stbl  // sample table box
 *                    stsd  // sample description box
 *                        avc1
 *                            avcC
 *                            btrt
 *                        mp4a
 *                    stts   // decoding time to sample box
 *                    ctts   // composition time to sample box
 *                    stss   // sync sample box
 *                    stdp   // independent and disposable samples box
 *                 dinf   // data information box
 *        edts  // edit box
 *    trak
 *    meta //metadata box
 *    mvex  // movie extends box
 *    pssh
 * moof
 *    mfhd
 *    traf
 *        tfhd
 *        tfdt
 *        trun
 *        sdtp
 * mdat
 */

import { Logger } from 'vod-fp-utility';
import { BytesForward, getBoxType } from '../utils/BytesForward';

let logger = new Logger('mux');

const MAX_UINT32_COUNT = Math.pow(2, 32);

const BOX_TYPE_DESC = {
  ftyp: 'file type and compatibility',
  moov: 'container for all metadata',
  mvhd: 'movie header,overall declarations',
  trak: 'container for an individual track or stream',
  tkhd: 'track header,overall information about the track',
  tref: 'track reference container',
  mdia: 'container for the media information in a track',
  mdhd: 'media header,oervall information about the media',
  hdlr: 'declares the media type',
  minf: 'media information container',
  vmhd: 'video media header',
  smhd: 'sound media header',
  dinf: 'data information box',
  stbl: 'sample table box',
  stsd: 'sample descriptions(codec types, etc)',
  stts: 'decoding time to sample',
  ctts: 'compostion time to sample',
  cslg: 'compostion to decode timeline mapping',
  stsc: 'sample to chunk',
  stsz: 'sample size',
  stco: 'chunk offset',
  stss: 'sync sample table',
  sdtp: 'independent abd disposable samples',
  sbgp: 'sample to group',
  mvex: 'movid extends box',
  moof: 'movie fragment',
  mfhd: 'movie fragment header',
  traf: 'track fragment',
  tfhd: 'track fragment header',
  trun: 'track fragment run',
  tfdt: 'track fragment decode time',
  mdat: 'media data',
  meta: 'metadata',
};

/**
 *  ISO base media file format
 *  各种box。第一个必须是 ftyp box
 *  ftyp:
 *      Brands 信息,一个 brand 是四字符codes
 *      两种类型的 brand , [major_brand,compatible_brands]
 */
function parseMp4(buffer) {
  logger.log(`--------mp4 parser,${buffer.byteLength}-----------`);
  const boxStore = splitBox(
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  );
  extractBoxsList(boxStore);
  return boxStore;
}

function splitBox(buffer, offset = 0) {
  let boxStore = [];
  for (; offset < buffer.byteLength; ) {
    const len =
      buffer[offset] * (1 << 24) +
      buffer[offset + 1] * (1 << 16) +
      buffer[offset + 2] * (1 << 8) +
      buffer[offset + 3];

    if (len < 9) {
      offset += len;
      continue;
    }
    let box = extractBox(offset, offset + len, buffer);
    boxStore.push(box);
    offset += len;
  }
  return boxStore;
}

function extractBox(start, length, buffer) {
  const box = buffer.subarray(start, length);
  const type = getBoxType(box, 4);
  return {
    length: box.byteLength,
    type,
    payload: box.subarray(8),
    typeDes: BOX_TYPE_DESC[type] || '',
  };
}

function extractBoxsList(boxList) {
  let sampleCount = 0;
  boxList.forEach((box) => {
    switch (box.type) {
      case 'ftyp':
      case 'styp':
        box.data = parseFtypBox(box.payload, box.length - 8);
        break;
      case 'mvhd':
        box.data = parseMvhd(box.payload, box.length);
        break;
      case 'moov':
      case 'trak':
      case 'mvex':
      case 'mdia':
      case 'minf':
      case 'dinf':
      case 'moof':
      case 'traf':
      case 'stbl':
        //The sample table contains all the time and data indexing of the media samples in a track. Using the tables
        //here, it is possible to locate samples in time, determine their type (e.g. I-frame or not), and determine their
        //size, container, and offset into that container
        box.data = splitBox(box.payload);
        extractBoxsList(box.data);
        break;
      case 'stsd':
        box.data = splitBox(box.payload, 8);
        extractBoxsList(box.data);
        break;
      case 'meta':
        box.data = splitBox(box.payload, 4);
        extractBoxsList(box.data);
        break;
      case 'tkhd':
        box.data = parseTrckHeader(box.payload);
        break;
      case 'mehd':
        box.data = parseMehd(box.payload);
        break;
      case 'mdhd':
        box.data = parseMdhd(box.payload);
        break;
      case 'mdhd':
        box.data = parseMdhd(box.payload);
        break;
      case 'hdlr':
        box.data = parseHdlr(box.payload);
        break;
      case 'trex':
        box.data = parseTrex(box.payload);
        break;
      case 'trun':
        box.data = parseTrun(box.payload);
        sampleCount = box.data.samples.length;
        break;
      case 'tfdt':
        box.data = parseTfdt(box.payload);
        break;
      case 'avc1':
        box.data = parseAvc1(box.payload);
        extractBoxsList(box.data);
        break;
      case 'mp4a':
        box.data = parseMp4a(box.payload);
        break;
      case 'avcC':
        box.data = parseAvcC(box.payload);
        break;
      case 'btrt':
        box.data = parseBtrt(box.payload);
        break;
      case 'stts':
        box.data = parseStts(box.payload);
        if (box.data.entries.length) {
          sampleCount = box.data.entries[0].sampleCount;
        }
        break;
      case 'ctts':
        box.data = parseCtts(box.payload);
        break;
      case 'cslg':
        box.data = parseCslg(box.payload);
        break;
      case 'stss':
        box.data = parseStss(box.payload);
        break;
      case 'stsz':
        box.data = parseStsz(box.payload);
        break;
      case 'stsc':
        box.data = parseStsc(box.payload);
        break;
      case 'stco':
        box.data = parseStco(box.payload);
        break;
      case 'sdtp':
        box.data = parseSdtp(box.payload, sampleCount);
        break;
      case 'mfhd':
        box.data = parseMfhd(box.payload);
        break;
      case 'tfhd':
        box.data = parseTfhd(box.payload);
        break;
      case 'pssh':
        box.data = parsePssh(box.payload);
        break;
      default:
        logger.warn('no parse box ', box.type);
        break;
    }
    if (box.data) {
      box.payload = null;
      delete box.payload;
    }
  });
}

function parseFtypBox(payload, length) {
  let bf = new BytesForward(payload);
  const ftypBox = {
    compatible: [],
  };
  ftypBox.major = getBoxType(payload, 0);
  bf.forward(4);
  ftypBox.version = bf.read32bitsValue();
  bf.forward(4);
  let compatible = [];
  for (let i = bf.offset; i < length; ) {
    ftypBox.compatible.push(getBoxType(payload, i));
    i += 4;
  }
  bf = null;

  return ftypBox;
}

// box 为 FullBox 要略过version[8bit]  flags[24 bit]

function parseMvhd(payload) {
  /**
   *  mvhd FullBox
   *  |----------mvhd---------------|
   *  |version--flags--createtime--modifytime--timescale--duration--rate--volume--xxxxx--next_track_ID--|
   *  |1-------3--------4------------4-----------4---------4--------4------2-------xx--------4--------|
   */
  let bf = new BytesForward(payload);
  let mvhdInfo = {};
  bf.forward(4); // 略过version[8bit]  flags[24 bit]
  mvhdInfo.createTime = bf.read32bitsValue();
  bf.forward(4);
  mvhdInfo.modifyTime = bf.read32bitsValue();
  bf.forward(4);
  mvhdInfo.timescale = bf.read32bitsValue();
  bf.forward(4);
  mvhdInfo.duration = bf.read32bitsValue();
  bf.forward(4);
  mvhdInfo.rate = bf.read16bitsValue();
  bf.forward(4); // end rate
  bf.forward(2); // end volume
  bf.forward(2 + 4 * 2 + 4 * 9 + 4 * 6);
  mvhdInfo.nextTrackId = bf.read32bitsValue();
  bf = null;

  return mvhdInfo;
}

function parseTrckHeader(payload) {
  /**
   * FullBox
   */
  let bf = new BytesForward(payload, 4);
  const tkhdInfo = {};
  const version = bf.read8bitsValue();
  tkhdInfo.version = version;
  if (version === 1) {
    bf.forward(8 + 8);
  } else {
    bf.forward(4 + 4);
  }
  tkhdInfo.trackId = bf.read32bitsValue();
  bf.forward(4);
  if (version === 1) {
    tkhdInfo.duration = bf.read32bitsValue() * MAX_UINT32_COUNT;
    bf.forward(4);
    tkhdInfo.duration += bf.read32bitsValue();
  } else {
    tkhdInfo.duration = bf.read32bitsValue();
  }
  let len = payload.byteLength;
  len -= 8;
  bf.offset = len;
  tkhdInfo.width = bf.read32bitsValue() >> 16;
  bf.forward(4);
  tkhdInfo.height = bf.read32bitsValue() >> 16;
  bf = null;

  return tkhdInfo;
}

function parseMdhd(payload) {
  /**
   * Fullbox
   *
   */
  const ret = {};
  let bf = new BytesForward(payload);
  const version = payload[0];
  bf.forward(4);
  if (version === 1) {
    bf.forward(4 * 4);
    ret.timescale = bf.read32bitsValue();
    bf.forward(4);
    ret.duration = bf.read32bitsValue() * MAX_UINT32_COUNT;
    bf.forward(4);
    ret.duration += bf.read32bitsValue();
  } else {
    bf.forward(4 * 2);
    ret.timescale = bf.read32bitsValue();
    bf.forward(4);
    ret.duration = bf.read32bitsValue();
  }
  return ret;
}

function parseHdlr(payload) {
  /**
   * track media data handler reference box
   * FullBox moov-> trak -> mdia->hdlr
   * int(32) pre_defined = 0;
   * int(32) handler_type;
   * int(32)[3] reserved = 0;
      string name
   */
  return {
    handlerType: getBoxType(payload, 8),
  };
}

function parseTrex(payload) {
  /**Fullbox
   * track extends box
   * one for each track in the Movie Box
   */
  let res = {};
  let bf = new BytesForward(payload);
  bf.forward(4);
  res.trackId = bf.read32bitsValue();
  bf.forward(4);
  res.defaultSdescriptionIndex = bf.read32bitsValue();
  bf.forward(4);
  res.defaultSampleDuration = bf.read32bitsValue();
  bf.forward(4);
  res.defaultSampleSize = bf.read32bitsValue();
  bf.forward(4);
  res.defaultSampleFlags = parseSampleFlag(payload, bf.offset);
  bf = null;

  return res;
}

function parseTrun(payload) {
  /**
   * Fullbox
   * version  8bit
   * tr_flags 24bit
   * unsigned int(32) sample_count;
   * // the following are optional fields
   * signed int(32) data_offset;
   * unsigned int(32) first_sample_flags;
   * // all fields in the following array are optional
   * {
   * unsigned int(32) sample_duration;
   * unsigned int(32) sample_size;
   * unsigned int(32) sample_flags
   * if (version == 0)
   * { unsigned int(32) sample_composition_time_offset; }
   * else
   * { signed int(32) sample_composition_time_offset; }
   * }[ sample_count ]
   * 【
   *  The number of optional fields is determined
   *  from the number of bits set in the lower byte of the tr_flags
   * 】
   */
  let res = {
    samples: [],
  };
  let bf = new BytesForward(payload);
  res.version = bf.read8bitsValue();
  bf.forward(1);
  res.flags = bf.readBytes(3);
  const {
    dataOffset,
    firstSampleFlags,
    sampleDuration,
    sampleSize,
    sampleFlas,
    sampleCto,
  } = parseTfFlags(res.flags);
  bf.forward(3);
  res.sampleCount = bf.read32bitsValue();
  bf.forward(4);
  if (dataOffset) {
    res.dataOffset = bf.read32bitsValue();
    bf.forward(4);
  }
  if (firstSampleFlags) {
    res.firstSampleFlags = parseSampleFlag(payload, bf.offset);
    bf.forward(4);
  }
  let i = 0;
  while (i < res.sampleCount) {
    let sample = {};
    if (sampleDuration) {
      sample.duration = bf.read32bitsValue();
      bf.forward(4);
    }
    if (sampleSize) {
      sample.size = bf.read32bitsValue();
      bf.forward(4);
    }
    if (sampleFlas) {
      sample.flags = parseSampleFlag(payload, bf.offset);
      bf.forward(4);
    }
    if (sampleCto) {
      sample.ctOffset = bf.read32bitsValue();
      bf.forward(4);
    }
    res.samples.push(sample);
    i++;
  }
  bf = null;
  return res;
}

function parseTfFlags(flags) {
  const [, recordFlag, optionsFlags] = flags;
  return {
    dataOffset: optionsFlags & 0x01,
    firstSampleFlags: optionsFlags & 0x04,
    sampleDuration: recordFlag & 0x01,
    sampleSize: (recordFlag & 0x02) >> 1,
    sampleFlas: (recordFlag & 0x04) >> 2,
    sampleCto: (recordFlag & 0x08) >> 3,
  };
}
function parseSampleFlag(payload, offset) {
  /** Fullbox
   *  bit(4) reserved=0;
      unsigned int(2) is_leading;
      unsigned int(2) sample_depends_on;
      unsigned int(2) sample_is_depended_on;
      unsigned int(2) sample_has_redundancy;
      bit(3) sample_padding_value;
      bit(1) sample_is_non_sync_sample;
      unsigned int(16) sample_degradation_priority;
   */
  return {
    isLeading: (payload[offset] & 0x0c) >> 2,
    dependsOn: payload[offset] & 0x03,
    isDenpendedOn: (payload[offset + 1] & 0xc0) >> 6,
    hasRedundancy: (payload[offset + 1] & 0x30) >> 4,
    padding: (payload[offset + 1] & 0x0e) >> 1,
    nonSync: payload[offset + 1] & 0x01,
    degradationPriority: (payload[offset + 2] << 8) | payload[offset + 3],
  };
}

function parseTfdt(payload) {
  /**
   * Fullbox
   */
  let bf = new BytesForward(payload);
  let baseMediaDecodeTime = 0;
  bf.forward(4);
  if (payload[0] === 1) {
    baseMediaDecodeTime = bf.read32bitsValue() * MAX_UINT32_COUNT;
    bf.forward(4);
    baseMediaDecodeTime += bf.read32bitsValue();
  } else {
    baseMediaDecodeTime = bf.read32bitsValue();
  }
  bf = null;
  return { baseMediaDecodeTime };
}

function parseAvc1(payload) {
  let bf = new BytesForward(payload);
  bf.forward(6 + 2);
  bf.forward(2 + 2 + 4 * 3);
  // logger.log('width', bf.read16bitsValue());
  bf.forward(2);
  // logger.log('height', bf.read16bitsValue());
  bf.forward(2);
  bf.forward(4 + 4 + 4 + 2 + 32 + 2 + 2);
  return splitBox(bf.subarray());
}

function parseAvcC(payload) {
  const ret = {
    sps: [],
    pps: [],
  };
  let bf = new BytesForward(payload);
  ret.configVersion = payload[0];
  ret.avcProfile = payload[1];
  ret.profileComptibility = payload[2];
  ret.avcLevel = payload[3];
  bf.forward(4);
  bf.forward(1);
  const nbSps = bf.readBytes(1) & 0x1f;
  bf.forward(1); // end nb sps
  for (let i = 0; i < nbSps; i++) {
    const spsLen = bf.read16bitsValue();
    bf.forward(2);
    ret.sps.push(bf.subarray(spsLen));
    bf.forward(spsLen);
  }
  const nbPps = bf.readBytes(1);
  bf.forward(1);
  for (let i = 0; i < nbPps; i++) {
    const ppsLen = bf.read16bitsValue();
    bf.forward(2);
    ret.pps.push(bf.subarray(ppsLen));
    bf.forward(ppsLen);
  }
  bf = null;
  return ret;
}

function parseMp4a(payload) {
  /**
   *
   */
  return {
    channelcount: payload[17],
    samplerate: (payload[24] << 8) | payload[25],
    codecConfigLength: payload[28 + 4 + 4 + 25], // ests:length+type+25
  };
}

function parseBtrt(payload) {
  let bf = new BytesForward(payload);
  let bufferSizeDB = bf.read32bitsValue();
  bf.forward(4);
  let maxBitrate = bf.read32bitsValue();
  bf.forward(4);
  let avgBitrate = bf.read32bitsValue();
  bf = null;
  return { bufferSizeDB, maxBitrate, avgBitrate };
}

function parseMeta(payload) {}

function parseStts(payload) {
  //  The Decoding Time to Sample Box contains decode time delta's: DT(n+1) = DT(n) + STTS(n) where STTS(n)
  //  is the (uncompressed) table entry for sample n
  //  The DT axis has a zero origin;
  let bf = new BytesForward(payload);
  bf.forward(4); // skip version flags
  let entryCount = bf.read32bitsValue();
  let entries = [];
  bf.forward(4);
  for (let i = 0; i < entryCount; i++) {
    let sampleCount = bf.read32bitsValue();
    bf.forward(4);
    let sampleDelta = bf.read32bitsValue();
    bf.forward(4);
    entries.push({
      sampleCount,
      sampleDelta,
    });
  }
  return { entries };
}
function parseCtts(payload) {
  let bf = new BytesForward(payload);
  bf.forward(4); // skip version flags
  let entryCount = bf.read32bitsValue();
  let entries = [];
  bf.forward(4);
  for (let i = 0; i < entryCount; i++) {
    let sampleCount = bf.read32bitsValue();
    bf.forward(4);
    let sampleOffset = bf.read32bitsValue();
    bf.forward(4);
    entries.push({
      sampleCount,
      sampleOffset,
    });
  }
  return { entries };
}
function parseCslg(payload) {
  let bf = new BytesForward(payload);
  let compositionToDTSShift = 0;
  let leastDecodeToDisplayDelta = 0;
  let greatestDecodeToDisplayDelta = 0;
  let compositionStartTime = 0;
  let compositionEndTime = 0;

  bf.forward(4);
  compositionToDTSShift = bf.read32bitsValueSigned();

  bf.forward(4);
  leastDecodeToDisplayDelta = bf.read32bitsValueSigned();

  bf.forward(4);
  greatestDecodeToDisplayDelta = bf.read32bitsValueSigned();

  bf.forward(4);
  compositionStartTime = bf.read32bitsValueSigned();

  bf.forward(4);
  compositionEndTime = bf.read32bitsValueSigned();
  return {
    compositionToDTSShift,
    leastDecodeToDisplayDelta,
    greatestDecodeToDisplayDelta,
    compositionStartTime,
    compositionEndTime,
  };
}
function parseStss(payload) {
  let bf = new BytesForward(payload);
  bf.forward(4);
  let entries = [];
  let entryCount = bf.read32bitsValue();
  bf.forward(4);

  for (let i = 0; i < entryCount; i++) {
    let samNum = bf.read32bitsValue();
    entries.push(samNum);
    bf.forward(4);
  }

  return { entries };
}

function parseStsz(payload) {
  // sample size box
  let bf = new BytesForward(payload);
  bf.forward(4);
  let sampleSize;
  let sampleCount;
  let entries = [];

  sampleSize = bf.read32bitsValue();
  bf.forward(4);
  sampleCount = bf.read32bitsValue();
  bf.forward(4);

  if (sampleSize === 0) {
    for (let i = 0; i < sampleCount; i++) {
      let size = bf.read32bitsValue();
      entries.push(size);
      bf.forward(4);
    }
  } else {
    console.warn('parse stsz, sample size not equal 0');
  }

  return { entries };
}
function parseStsc(payload) {
  // sample chunk box
  // Samples within the media data are grouped into chunks. Chunks can be of different sizes, and the samples
  // within a chunk can have different sizes.
  let bf = new BytesForward(payload);
  bf.forward(4);

  let entries = [];
  let entryCount = bf.read32bitsValue();
  bf.forward(4);

  for (let i = 0; i < entryCount; i++) {
    let firstChunk = bf.read32bitsValue();
    bf.forward(4);
    let samplesPreChunk = bf.read32bitsValue();
    bf.forward(4);
    let sampleDesIndex = bf.read32bitsValue();
    bf.forward(4);

    entries.push({
      firstChunk,
      samplesPreChunk,
      sampleDesIndex,
    });
  }

  return { entries };
}

function parseStco(payload) {
  // chunk offset box
  let bf = new BytesForward(payload);
  bf.forward(4);

  let entryCount = bf.read32bitsValue();
  let entries = [];

  bf.forward(4);

  for (let i = 0; i < entryCount; i++) {
    let offset = bf.read32bitsValue();
    entries.push(offset);
    bf.forward(4);
  }

  return { entries };
}

function parseMehd(payload) {
  let bf = new BytesForward(payload);
  bf.forward(4);
  let fragDuration;
  if (payload[0] == 1) {
    let upper = bf.read32bitsValue();
    bf.forward(4);
    let lower = bf.read32bitsValue();
    fragDuration = upper * (1 << 30) * 2 + lower;
  } else {
    fragDuration = bf.read32bitsValue();
  }
  return { fragDuration };
}

function parseMfhd(payload) {
  let bf = new BytesForward(payload);
  bf.forward(4);
  let seqNumber = bf.read32bitsValue();
  return { seqNumber };
}

function parseTfhd(payload) {
  let bf = new BytesForward(payload);
  bf.forward(1);
  let flags = bf.readBytes(3);
  bf.forward(3);
  let trackId = bf.read32bitsValue();
  return { trackId, flags };
}

function parseSdtp(payload, sampleCount) {
  let bf = new BytesForward(payload);
  bf.forward(4);
  let entries = [];
  let isLeading;
  let dependsOn;
  let isDenpendedOn;
  let hasRedundancy;

  for (let i = 0; i < sampleCount; i++) {
    let c = bf.read8bitsValue();
    isLeading = (c & 0xc0) >> 6;
    dependsOn = (c & 0x30) >> 4;
    isDenpendedOn = (c & 0x0c) >> 2;
    hasRedundancy = c & 0x03;
    entries.push({
      isLeading,
      dependsOn,
      isDenpendedOn,
      hasRedundancy,
    });
    bf.forward(1);
  }

  return { entries };
}

function parsePssh(payload) {
  const ret = {};
  const version = payload[0];
  let bf = new BytesForward(payload);
  bf.forward(4);
  ret.systemId = bytesToHex(bf.readBytes(16));
  bf.forward(16);
  if (version > 0) {
    const kidCount = bf.read32bitsValue();
    ret.kids = [];
    let i = 0;
    bf.forward(4);
    while (i < kidCount) {
      ret.kids.push(bytesToHex(bf.readBytes(16)));
      bf.forward(16);
      i++;
    }
  }
  const dataSize = bf.read32bitsValue();
  bf.forward(4);
  ret.dataSize = dataSize;
  ret.data = bf.readBytes(dataSize);
  ret.dataToBase64 = btoa(bytesToStr(ret.data));
  return ret;
}

function bytesToHex(arr) {
  return arr.map((x) => x.toString(16)).join('');
}

function bytesToStr(arr) {
  return arr.map((x) => String.fromCharCode(x)).join('');
}

export default parseMp4;

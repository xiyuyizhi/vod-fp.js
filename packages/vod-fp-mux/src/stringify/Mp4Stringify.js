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
 * mdat
 */

import {Logger} from 'vod-fp-utility';
import {BytesForward, getBoxType} from '../utils/BytesForward';
import {mp4Probe} from "../utils/probe"

let logger = new Logger('mux');

const MAX_UINT32_COUNT = Math.pow(2, 32);

/**
 *  ISO base media file format
 *  各种box。第一个必须是 ftyp box
 *  ftyp:
 *      Brands 信息,一个 brand 是四字符codes
 *      两种类型的 brand , [major_brand,compatible_brands]
 */
function parseMp4(buffer) {
  console.log(mp4Probe(buffer));

  logger.log(`--------mp4 parser,${buffer.byteLength}-----------`);
  const boxStore = splitBox(buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : buffer);
  extractBoxsList(boxStore);
  return boxStore;
}

function splitBox(buffer, offset = 0) {
  let boxStore = [];
  for (; offset < buffer.byteLength;) {
    const len = buffer[offset] * (1 << 24) + buffer[offset + 1] * (1 << 16) + buffer[offset + 2] * (1 << 8) + buffer[offset + 3];
    if (len === 0) {
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
  return {
    length: box.byteLength,
    type: getBoxType(box, 4),
    payload: box.subarray(8)
  };
}

function extractBoxsList(boxList) {
  boxList.forEach(box => {
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
        box.data = splitBox(box.payload);
        extractBoxsList(box.data);
        break;
      case 'stsd':
        box.data = splitBox(box.payload, 8);
        extractBoxsList(box.data);
        break;
      case 'tkhd':
        box.data = parseTrckHeader(box.payload);
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
    compatible: []
  };
  ftypBox.major = getBoxType(payload, 0);
  bf.forward(4);
  ftypBox.version = bf.read32bitsValue();
  bf.forward(4);
  let compatible = [];
  for (let i = bf.offset; i < length;) {
    ftypBox
      .compatible
      .push(getBoxType(payload, i));
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
   *  |--length---version--flags--createtime--modifytime--timescale--duration--rate--volume--xxxxx--next_track_ID--|
   *  |----4--------1-------3--------4------------4-----------4---------4--------4------2-------xx--------4--------|
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
    handlerType: getBoxType(payload, 8)
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
    samples: []
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
    sampleCto
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
    res
      .samples
      .push(sample);
    i++;
  }
  bf = null;
  return res;
}

function parseTfFlags(flags) {
  const [,
    recordFlag,
    optionsFlags] = flags;
  return {
    dataOffset: optionsFlags & 0x01,
    firstSampleFlags: optionsFlags & 0x04,
    sampleDuration: recordFlag & 0x01,
    sampleSize: (recordFlag & 0x02) >> 1,
    sampleFlas: (recordFlag & 0x04) >> 2,
    sampleCto: (recordFlag & 0x08) >> 3
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
    degradationPriority: (payload[offset + 2] << 8) | payload[offset + 3]
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
  return {baseMediaDecodeTime};
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
    pps: []
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
    ret
      .sps
      .push(bf.subarray(spsLen));
    bf.forward(spsLen);
  }
  const nbPps = bf.readBytes(1);
  bf.forward(1);
  for (let i = 0; i < nbPps; i++) {
    const ppsLen = bf.read16bitsValue();
    bf.forward(2);
    ret
      .pps
      .push(bf.subarray(ppsLen));
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
    codecConfigLength: payload[28 + 4 + 4 + 25] // ests:length+type+25
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
  return {bufferSizeDB, maxBitrate, avgBitrate};
}

function parsePssh(payload) {
  const ret = {};
  const version = payload[0];
  let bf = new BytesForward(payload);
  bf.forward(4);
  ret.systemId = bf.readBytes(16);
  bf.forward(16);
  if (version > 0) {
    const kidCount = bf.read32bitsValue();
    ret.kids = [];
    let i = 0;
    while (i < kidCount) {
      ret
        .kids
        .push(bf.readBytes(16));
      bf.forward(16);
    }
  }
  const dataSize = bf.read32bitsValue();
  bf.forward(4);
  ret.dataSize = dataSize;
  ret.data = bf.readBytes(dataSize);
  return ret;
}

export default parseMp4;

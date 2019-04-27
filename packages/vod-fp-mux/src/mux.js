import ExpGolomb from './exp-golomb';
import remux from './remux';

let logger = {
  log: (...rest) => {
    console.log(...rest);
  },
  warn: (...rest) => {
    console.warn(...rest);
  },
  error: console.error.bind(console)
};

logger.log = () => {};
logger.warn = () => {};

let pmtId;
let streamInfo;
let avcData;
let restNaluBuffer = null; // 暂存pes开头那些属于上一个 pes最后一个nalu 的数据
let audioData;
let avcTrack = {
  samples: [],
  inputTimeScale: 90000,
  timescale: 90000,
  id: 1, // video
  duration: 10,
  type: 'video',
  sequenceNumber: 0
};
let sampleOrder = '';
let avcSample = null;
let pesCount = 0;

export default mux;

function reset(sequenceNumber) {
  avcData = null;
  avcTrack.samples = [];
  avcTrack.sequenceNumber = sequenceNumber;
  sampleOrder = '';
  avcSample = null;
  pesCount = 0;
}

function mux(buffer, sequenceNumber) {
  let bf = buffer;
  if (buffer instanceof ArrayBuffer) {
    bf = new Uint8Array(buffer);
  }
  reset(sequenceNumber);
  const syncOffset = _probe(buffer);
  logger.log('监测ts流第一个同步字节的位置: ', syncOffset);

  let len = buffer.byteLength;
  len -= (len - syncOffset) % 188;
  // reset avcData for new ts stream
  for (let i = syncOffset, j = 0; i < len; ) {
    let payload;
    let header;
    let adaptionsOffset = 0;
    header = parseTsHeaderInfo(buffer.subarray(i, i + 4));
    // logger.log(buffer.subarray(188 * i, 188 * 32));
    // logger.log(`packet ${i + 1}: `, header);
    // logger.log(`packet ${i + 1} header: `, _tsPacketHeader(buffer, 188 * i));
    payload = buffer.subarray(i + 4, i + 188);
    // logger.log('payload :', payload);
    if (
      header.adaptationFiledControl === 3 ||
      header.adaptationFiledControl === 2
    ) {
      adaptionsOffset = parseAdaptationFiled(payload) + 1;
      // logger.warn('detect adaptationFiled', adaptionsOffset);
    }
    parsePayload(payload, adaptionsOffset, header);
    i += 188;
  }
  // 还剩最后一个pes没解析
  if (avcData && avcData.data.length) {
    pesCount++;
    const pes = parsePES(avcData, 0);
    logger.log('last video PES data: ', pes);
    logger.log('video pes count: ', pesCount);
    parseAVC(pes, true);
  }
  try {
    const bff = remux(avcTrack);
    mux.emit('MUX_DATA', bff);
  } catch (e) {
    mux.emit('MUX_DATA', []);
  }
}

mux.eventBus = {};

mux.on = (event, listener) => {
  if (mux.eventBus[event]) {
    mux.eventBus[event].push(listener);
  } else {
    mux.eventBus[event] = [listener];
  }
};

mux.emit = (event, data) => {
  let listeners = mux.eventBus[event];
  listeners.forEach(listener => {
    listener(data);
  });
};

function _probe(data) {
  const len = Math.min(1000, data.byteLength - 3 * 188);
  for (let i = 0; i < len; i++) {
    if (
      data[i] === 0x47 &&
      data[i + 188] === 0x47 &&
      data[i + 188 * 2] === 0x47
    ) {
      return i;
    }
  }
  return -1;
}

function _tsPacketHeader(data, start) {
  const header = data.subarray(start, start + 4);
  return [...header]
    .map(x => x.toString(2))
    .map(x => _paddingLeft(x, 8 - x.length, '0'));
}

function _paddingLeft(origin, count, val) {
  if (count) {
    return new Array(count).fill(val).join('') + origin;
  }
  return origin;
}

function parseTsHeaderInfo(data) {
  /** https://en.wikipedia.org/wiki/MPEG_transport_stream
   * 第一字节 0x47
   * 第二字节:
   *    bit1 :Transport Error Indicator (TEI) & 0x80
   *    bit2 : Payload Unit Start Indicator   & 0x40
   *    bit3 : Transport               & 0x20
   * rest+第三字节:  pid    & 0x1f << 8 + 第三字节
   * 第四字节:
   *    bit1-2 : Transport Scrambling Control  & 0xc0
   *    bit2-4 : Adaptation field control      & 0x30 【00 01 no  adaptation】
   *    bit4-8 : Continuity counter            & 0x0f
   * */
  if (data[0] === 0x47) {
    const result = {};
    result.tsErrorIndicator = data[1] & 0x80;
    result.payloadStartIndicator = (data[1] & 0x40) >> 6;
    result.pid = ((data[1] & 0x1f) << 8) + data[2];
    result.tsc = (data[3] & 0xc0) >> 6;
    result.adaptationFiledControl = (data[3] & 0x30) >> 4;
    result.cc = data[3] & 0x0f;
    return result;
  }
  return null;
}

function parseAdaptationFiled(payload) {
  /**
   *  header 中 Adaptation field control
   *    10 : adaptation field only, no payload
   *    11 : adaptation field followed by payload
   *  第一字节 : Adaptation Field Length
   */
  const adaptationLength = payload[0];
  return Math.min(adaptationLength, 188 - 5);
}

function parsePayload(payload, offset, header) {
  /**
   * https://en.wikipedia.org/wiki/Program-specific_information
   *
   * |---Adaptation Filed(option)---|--payload--|
   * PSI:[PAT PMT CAT]
   *    第一字节 : pointer field  0 or not
   *    N * 0xFF : Pointer filler bytes 【pointer field 为 0 时不存在】
   * payload 针对PAT:
   * ISO-13818-1 Table-2-25
   *    table id : 1字节 【0x00: PAT、0x01: CAT、0x02: PMT、0x40: NIT】section
   *    Section syntax indicator : 1bit
   *    0 : 1bit
   *    Reserved bits : 2bit  11
   *    Section length : 12bit
   *    .
   *    .
   *    .共10 bytes
   */
  if (header.payloadStartIndicator === 1 && header.pid == 0) {
    logger.warn('parse PAT');
    const pointerFiledLen = 1 + payload[offset];
    offset = offset + pointerFiledLen; // table start position
    pmtId = ((payload[offset + 10] & 0x1f) << 8) | payload[offset + 11];
    const pNum = (payload[offset + 8] << 8) | payload[offset + 9];
    logger.log('program number: ' + pNum, ',pmtId: ' + pmtId);
    return;
  }
  if (header.payloadStartIndicator === 1 && header.pid === pmtId) {
    const pointerFiledLen = 1 + payload[offset];
    offset = offset + pointerFiledLen; // table start position
    streamInfo = parsePMT(payload, offset);
    return;
  }

  if (streamInfo && header.pid === streamInfo.video) {
    if (header.payloadStartIndicator === 1) {
      pesCount++;
      // first start payload
      if (avcData) {
        const pes = parsePES(avcData, 0);
        logger.log('video PES data: ', pes);
        window.pes = pes;
        parseAVC(pes);
      }
      // logger.log(avcData);
      avcData = { data: [], size: 0 };
    }
    if (avcData) {
      // normal payload
      let temp = payload.subarray(offset);
      avcData.data.push(temp);
      avcData.size += temp.byteLength;
    }
  }
}

function parsePMT(payload, offset) {
  /**
   * ISO-13818-1 Table-2-25
   * payload 针对 PMT:
   *  section_length : 12bit 【table 第2字节后四位，3字节】
   *  program_number : 16bit 【table第4，5字节】
   *  program_info_length : 12bit 【table 第11字节后 4bit + 第12 byte】
   *  N * 8 : descriptor
   *  stream_type : 8bit
   *  reserved : 3bit
   *  elementary_PID : 13bit
   *  reserved : 4bit
   *  ES_info_length: 12bit
   */
  logger.warn('parse PMT');
  const sectionLen = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];
  logger.log('section_length: ' + sectionLen);
  const tableEnd = offset + 3 + sectionLen - 4;
  const pNum = (payload[offset + 3] << 8) | payload[offset + 4];
  logger.log('program_number: ' + pNum);
  const pil = ((payload[offset + 10] & 0x0f) << 8) | payload[offset + 11] || 0;
  logger.log('program_info_length: ' + pil);
  offset = offset + 11 + pil + 1; // stream_type position
  const result = {
    video: -1,
    audio: -1
  };
  let stremType;
  while (offset < tableEnd) {
    stremType = payload[offset];
    stremType = '0x' + ('00' + stremType.toString(16)).slice(-2);
    logger.log('stremType: ' + stremType);
    offset += 1; // ele_Pid position
    const ePid = ((payload[offset] & 0x1f) << 8) | payload[offset + 1];
    logger.log('elementary_PID: ' + ePid);
    offset += 2; // es_info_l position
    const esil = ((payload[offset] & 0x0f) << 8) | payload[offset + 1];
    logger.log('ES_info_length: ' + esil);
    offset += 2;
    switch (stremType) {
      case '0x1b':
        result.video = ePid;
        break;
      case '0x0f':
        result.audio = ePid;
        break;
      default:
    }
  }
  return result;
}

function parsePES(stream, offset) {
  /**
   * http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
   * ISO-13818-1 Table-2-17
   * packet_start_code_prefix : 24bit 0x000001
   * stream_id : 8bit
   * PES_packet_length : 16bit
   * PTS_DTS_flags : 2bit 【PES_packet_length后第2字节前2位】& 0xc0  [0x10 0x11]
   * PES_header_data_length : 【PTS_DTS_flags 后1字节】
   */
  let pesLen = 0;
  let pts;
  let dts;
  const firstPayload = stream.data[0];
  // logger.log(offset, firstPayload);
  const pscp =
    (firstPayload[offset] << 16) |
    (firstPayload[offset + 1] << 8) |
    firstPayload[offset + 2];
  if (pscp === 0x000001) {
    logger.warn('parse PES');
    offset += 3;
    logger.log('stream_id: ' + firstPayload[offset]);
    pesLen = (firstPayload[offset + 1] << 8) | firstPayload[offset + 2];
    logger.log('pes packet length: ' + pesLen);
    offset += 4;
    const pdtsFlag = (firstPayload[offset] & 0xc0) >> 6;
    logger.log('PTS_DTS_flags: ' + pdtsFlag);
    offset += 1;
    const pesHdrLen = firstPayload[offset];
    logger.log('PES_header_data_length: ' + pesHdrLen);
    offset += 1;
    if (pdtsFlag) {
      ({ pts, dts } = parsePESHeader(firstPayload, offset, pdtsFlag));
    }
    // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
    let payloadStartOffset = pesHdrLen + 6 + 3;
    stream.size -= payloadStartOffset;
    // reassemble PES packet
    let pesData = new Uint8Array(stream.size);
    let i = 0;
    for (let j = 0, dataLen = stream.data.length; j < dataLen; j++) {
      let frag = stream.data[j];
      let len = frag.byteLength;
      if (payloadStartOffset) {
        if (payloadStartOffset > len) {
          // trim full frag if PES header bigger than frag
          payloadStartOffset -= len;
          continue;
        } else {
          // trim partial frag if PES header smaller than frag
          frag = frag.subarray(payloadStartOffset);
          len -= payloadStartOffset;
          payloadStartOffset = 0;
        }
      }
      pesData.set(frag, i);
      i += len;
    }
    if (pesLen) {
      // payload size : remove PES header + PES extension
      pesLen = pesLen - pesHdrLen - 3;
    }
    return {
      data: pesData,
      pts,
      dts,
      len: pesLen,
      tsPacket: stream.data
    };
  }
  logger.error(`parse pes error,pscp = ${pscp}`);
  logger.log(stream.data, stream.size, offset);

  return null;
}

function parsePESHeader(payload, offset, pdtsFlag) {
  let pts;
  let dts;
  pts =
    (payload[offset] & 0x0e) * 536870912 + // 1 << 29
    (payload[offset + 1] & 0xff) * 4194304 + // 1 << 22
    (payload[offset + 2] & 0xfe) * 16384 + // 1 << 14
    (payload[offset + 3] & 0xff) * 128 + // 1 << 7
    (payload[offset + 4] & 0xfe) / 2;
  if (pts > 4294967295) {
    // decrement 2^33
    pts -= 8589934592;
  }
  offset += 5;
  if (pdtsFlag === 3) {
    // have dts
    dts =
      (payload[offset] & 0x0e) * 536870912 + // 1 << 29
      (payload[offset + 1] & 0xff) * 4194304 + // 1 << 22
      (payload[offset + 2] & 0xfe) * 16384 + // 1 << 14
      (payload[offset + 3] & 0xff) * 128 + // 1 << 7
      (payload[offset + 4] & 0xfe) / 2;
    // check if greater than 2^32 -1
    if (dts > 4294967295) {
      // decrement 2^33
      dts -= 8589934592;
    }
    if (pts - dts > 60 * 90000) {
      logger.warn(
        `${Math.round(
          (pts - dts) / 90000
        )}s delta between PTS and DTS, align them`
      );
      pts = dts;
    }
  } else {
    dts = pts;
  }
  logger.log('pts,dts: ', pts, dts);
  return { pts, dts };
}

function parseAVCNALu(pes) {
  /**
   * https://en.wikipedia.org/wiki/Network_Abstraction_Layer
   * ISO-14496-10 7.3.1
   *
   *  forbidden_zero_bit  1bit
   *  nal_ref_idc  2bit
   *  nal_unit_type 5bit
   */
  logger.warn('parse avc Nal units');
  // logger.log(pes.data);
  const buffer = pes.data;
  const len = buffer.byteLength;
  let i = 0;
  let lastUnitStart = 0;
  let units = [];
  let nalStartInPesStart = true;
  let getNalUStartIndex = i => {
    let codePrefix3 = (buffer[i] << 16) | (buffer[i + 1] << 8) | buffer[i + 2];
    let codePrefix4 =
      (buffer[i] << 24) |
      (buffer[i + 1] << 16) |
      (buffer[i + 2] << 8) |
      buffer[i + 3];
    if (codePrefix4 === 0x00000001 || codePrefix3 === 0x000001) {
      return {
        index: i,
        is3Or4: codePrefix4 === 1 ? 4 : 3
      };
    }
    return { index: -1 };
  };

  if (getNalUStartIndex(0).index === -1) {
    nalStartInPesStart = false;
  }
  while (i <= len - 4) {
    let { index, is3Or4 } = getNalUStartIndex(i);
    if (index !== -1) {
      // 去除 pes中nal unit不是开始于第一字节的那部分数据 [把这部分数据添加到上一个采样的最后一个nal unit 中]
      if (index !== 0 && nalStartInPesStart) {
        let nalUnit = buffer.subarray(lastUnitStart, i);
        units.push({
          data: nalUnit,
          nalIdc: (nalUnit[0] & 0x60) >> 5,
          nalType: nalUnit[0] & 0x1f
        });
        if ((nalUnit[0] & 0x1f) === 5) {
          logger.error('detect IDR');
        }
      }
      if (!nalStartInPesStart) {
        //属于最新一个采样最后一个nal
        restNaluBuffer = buffer.subarray(0, index);
      }
      lastUnitStart = index + is3Or4;
      i = lastUnitStart;
      nalStartInPesStart = true;
    }
    i++;
  }
  if (lastUnitStart && lastUnitStart < len) {
    let last = buffer.subarray(lastUnitStart);
    units.push({
      data: last,
      nalIdc: (last[0] & 0x60) >> 5,
      nalType: last[0] & 0x1f
    });
  }
  if (units.length === 0) {
    // 这个pes中不存在Nal unit,则可能上一个pes的Nal unit还没结束
    // todo: 把这个pes舔到上一个pes的最后一个nal unit中
    logger.log('%c pes中不存在 Nal  unit', 'background: #000; color: #ffffff');
  }
  return units;
}

function parseAVC(pes, lastPes) {
  /**
   * nal_unit_type
   * 1 : non-IDR picture
   * 2-4 : slice data partition
   * 5 : IDR picture I帧
   * 6 : SEI
   * 7 : SPS
   * 8 : PPS
   * 9 : access unit delimiter | AUD
   */
  const nalUnits = parseAVCNALu(pes);
  pes.data = null;
  let spsFound = false;
  let createAVCSample = function(key, pts, dts, debug) {
    return {
      key: key,
      pts: pts,
      dts: dts,
      units: []
    };
  };

  /**
   * case:
   *
   * 1.  idr帧非开始于分片开头
   *    |                       分片                                  |
   *    |         pes         |      pes   |      pes   |      pes   |
   *    |ndr...sps | pps | idr|  aud | ndr |  aud | ndr |  aud | ndr |
   *    |------delete  -------|
   *
   * 2. 对 分片最后一个pes的特殊处理,解析完 nalu后就 add sample
   *
   */

  const paddingAndPushSample = () => {
    if (restNaluBuffer) {
      const units = avcSample.units;
      if (units.length) {
        const saved = units[units.length - 1].data;
        const newUnit = new Uint8Array(
          saved.byteLength + restNaluBuffer.byteLength
        );
        newUnit.set(saved, 0);
        newUnit.set(restNaluBuffer, saved.byteLength);
        units[units.length - 1].data = newUnit;
      }
      restNaluBuffer = null;
    }
    pushAvcSample(avcSample);
    avcSample = null;
  };

  nalUnits.forEach(unit => {
    switch (unit.nalType) {
      case 9:
        if (avcSample) {
          // 下一采样【下一帧】开始了，要把这一个采样入track
          logger.log('access units order: ', sampleOrder);
          sampleOrder = '';
          paddingAndPushSample();
        }
        sampleOrder += '|AUD ';
        avcSample = createAVCSample(false, pes.pts, pes.dts);
        break;
      case 5:
        sampleOrder += '->IDR ';
        if (!avcSample) {
          avcSample = createAVCSample(true, pes.pts, pes.dts);
        }
        avcSample.frame = true;
        avcSample.key = true;
        avcTrack.key = true;
        break;
      case 1:
        sampleOrder += '->NDR ';
        if (!avcSample) {
          avcSample = createAVCSample(true, pes.pts, pes.dts);
        }
        if (unit.nalIdc !== 0) {
        }
        avcSample.frame = true;
        // 判断是否为关键帧
        // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
        if (spsFound && unit.data.length > 4) {
          let sliceType = new ExpGolomb(unit.data).readSliceType();
          if (
            sliceType === 2 ||
            sliceType === 4 ||
            sliceType === 7 ||
            sliceType === 9
          ) {
            avcSample.key = true;
          }
        }
        break;
      case 7:
        spsFound = true;
        sampleOrder += '->SPS ';
        parseSPS(unit);
        break;
      case 8:
        sampleOrder += '->PPS ';
        if (!avcTrack.pps) {
          avcTrack.pps = [unit.data];
        }
        break;
      default:
        sampleOrder += `->unknow ${unit.nalType}`;
        logger.warn(`unknow ${unit.nalType}`);
    }
    if (avcSample && [1, 5, 6, 7, 8].includes(unit.nalType)) {
      let units = avcSample.units;
      units.push(unit);
    }
  });

  if (lastPes) {
    paddingAndPushSample();
  }
}

function pushAvcSample(sample) {
  if (sample.units.length && sample.frame) {
    if (sample.key === true || (avcTrack.sps && avcTrack.samples.length)) {
      avcTrack.samples.push(sample);
    }
  }
}

function parseSPS(unit) {
  if (!avcTrack.sps) {
    let expGolombDecoder = new ExpGolomb(unit.data);
    let config = expGolombDecoder.readSPS();
    avcTrack.width = config.width;
    avcTrack.height = config.height;
    avcTrack.pixelRatio = config.pixelRatio;
    avcTrack.sps = [unit.data];
    let codecarray = unit.data.subarray(1, 4);
    let codecstring = 'avc1.';
    for (let i = 0; i < 3; i++) {
      let h = codecarray[i].toString(16);
      if (h.length < 2) {
        h = '0' + h;
      }
      codecstring += h;
    }
    avcTrack.codec = codecstring;
  }
}

function discardEPB(data) {
  let length = data.byteLength;
  let EPBPositions = [];
  let i = 1;
  let newLength;
  let newData;

  // Find all `Emulation Prevention Bytes`
  while (i < length - 2) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
      EPBPositions.push(i + 2);
      i += 2;
    } else {
      i++;
    }
  }

  // If no Emulation Prevention Bytes were found just return the original
  // array
  if (EPBPositions.length === 0) {
    return data;
  }

  // Create a new array to hold the NAL unit data
  newLength = length - EPBPositions.length;
  newData = new Uint8Array(newLength);
  let sourceIndex = 0;

  for (i = 0; i < newLength; sourceIndex++, i++) {
    if (sourceIndex === EPBPositions[0]) {
      // Skip this byte
      sourceIndex++;
      // Remove this position index
      EPBPositions.shift();
    }
    newData[i] = data[sourceIndex];
  }
  return newData;
}

function insertSampleInOrder(arr, data) {
  let len = arr.length;
  if (len > 0) {
    if (data.pts >= arr[len - 1].pts) {
      arr.push(data);
    } else {
      for (let pos = len - 1; pos >= 0; pos--) {
        if (data.pts < arr[pos].pts) {
          arr.splice(pos, 0, data);
          break;
        }
      }
    }
  } else {
    arr.push(data);
  }
}

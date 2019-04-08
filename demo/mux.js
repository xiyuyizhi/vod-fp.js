import ExpGolomb from './exp-golomb';
import remux from './remux';

console.log('%c mux ', 'background: #222; color: #bada55');
// console.log = () => {};
// console.warn = () => {};

let DEBUGE_PLAY = true;
// let DEBUGE_PLAY = false;

let max = 105000;
// let max = 800;
let pmtId;
let streamInfo;
let avcData;
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
function convertStrToBuffer(str) {
  return new Uint8Array(str.split('').map(x => x.charCodeAt(0)));
}

function converBufferToStr(buffer) {
  let temp = [];
  buffer.forEach(b => {
    temp.push(String.fromCharCode(b));
  });
  return temp.join('');
}

let mediaSource;
let videoBuffer;

function bufferManage() {
  mediaSource = new window.MediaSource();
  mediaSource.addEventListener('sourceopen', onSourceOpen);
  document.querySelector('#video').src = URL.createObjectURL(mediaSource);
}

function onSourceOpen() {
  console.log('readyState:', mediaSource.readyState);
  videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  videoBuffer.addEventListener('updateend', function(_) {
    console.log('buffer update end');
    mediaSource.endOfStream();
    // document.querySelector('#video').play();
  });
  videoBuffer.addEventListener('error', e => {
    console.log(e);
  });
}

bufferManage();

document.querySelector('#upload').addEventListener('change', e => {
  const [file] = e.target.files;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    const buffer = new Uint8Array(e.target.result);
    setLocal('bfs', converBufferToStr(buffer));
    mux(buffer);
  };
  reader.readAsArrayBuffer(file);
});

function setLocal(key, val) {
  localStorage.setItem(key, val);
}

function getLocal(key) {
  return localStorage.getItem(key);
}

const localBf = getLocal('bfs');

if (localBf) {
  mux(convertStrToBuffer(localBf));
}

function mux(buffer) {
  let bf = buffer;
  if (buffer instanceof ArrayBuffer) {
    bf = new Uint8Array(buffer);
  }
  window.bf = buffer;
  console.log(buffer);

  const syncOffset = _probe(buffer);
  console.log('监测ts流第一个同步字节的位置: ', syncOffset);

  let len = buffer.byteLength;
  len = len - ((len - syncOffset) % 188);
  // reset avcData for new ts stream
  avcData = null;
  for (let i = syncOffset, j = 0; j < max, i < len; ) {
    let payload;
    let header;
    let adaptions;
    let adaptionsOffset = 0;
    header = parseTsHeaderInfo(buffer.subarray(i, i + 4));
    // console.log(buffer.subarray(188 * i, 188 * 32));
    // console.log(`packet ${i + 1}: `, header);
    // console.log(`packet ${i + 1} header: `, _tsPacketHeader(buffer, 188 * i));
    payload = _tsPacketPayload(buffer, i + 4, i + 188);
    // console.log('payload :', payload);
    if (header.adaptationFiledControl === 3) {
      // console.warn('detect adaptationFiled');
      adaptions = parseAdaptationFiled(payload);
      adaptionsOffset = adaptions.adaptationLength;
      // console.log(adaptions);
    }
    parsePayload(payload, adaptionsOffset, header);
    i += 188;
    j++;
  }
  //还剩最后一个pes没解析
  if (avcData && avcData.data.length) {
    pesCount++;
    const pes = parsePES(avcData, 0);
    console.log('last video PES data: ', pes);
    console.log('video pes count: ', pesCount);
    parseAVC(pes);
  }
  if (DEBUGE_PLAY) {
    const bff = remux(avcTrack);
    setTimeout(() => {
      videoBuffer.appendBuffer(bff);
    }, 100);
  }
}

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
function _tsPacketPayload(data, start, end) {
  return data.subarray(start, end);
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
   *    bit3 : Transport Priority             & 0x20
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
  return {
    adaptationLength: Math.min(adaptationLength, 188 - 4) + 1
  };
}

function parsePayload(payload, offset, header) {
  /**
   * https://en.wikipedia.org/wiki/Program-specific_information
   *
   * |---Adaptation Filed(option)---|--payload--|
   * PSI:
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
    offset += 1 + payload[offset]; // table start position
    pmtId = ((payload[offset + 10] & 0x1f) << 8) | payload[offset + 11];
    const pNum = (payload[offset + 8] << 8) | payload[offset + 9];
    console.warn('parse PAT');
    console.log('program number: ' + pNum, ',pmtId: ' + pmtId);
    return;
  }
  if (header.payloadStartIndicator === 1 && header.pid === pmtId) {
    offset += 1 + payload[offset]; // table start position
    streamInfo = parsePMT(payload, offset);
    return;
  }

  if (streamInfo && header.pid === streamInfo.video) {
    if (header.payloadStartIndicator === 1) {
      pesCount++;
      // first start payload
      if (avcData) {
        const pes = parsePES(avcData, 0);
        console.log('video PES data: ', pes);
        window.pes = pes;
        parseAVC(pes);
      }
      // console.log(avcData);
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
  console.warn('parse PMT');
  const sectionLen = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];
  console.log('section_length: ' + sectionLen);
  const tableEnd = offset + 3 + sectionLen - 4;
  const pNum = (payload[offset + 3] << 8) | payload[offset + 4];
  console.log('program_number: ' + pNum);
  const pil = ((payload[offset + 10] & 0x0f) << 8) | payload[offset + 11] || 0;
  console.log('program_info_length: ' + pil);
  offset = offset + 11 + pil + 1; // stream_type position
  const result = {
    video: -1,
    audio: -1
  };
  let stremType;
  while (offset < tableEnd) {
    stremType = payload[offset];
    stremType = '0x' + ('00' + stremType.toString(16)).slice(-2);
    console.log('stremType: ' + stremType);
    offset += 1; // ele_Pid position
    const ePid = ((payload[offset] & 0x1f) << 8) | payload[offset + 1];
    console.log('elementary_PID: ' + ePid);
    offset += 2; // es_info_l position
    const esil = ((payload[offset] & 0x0f) << 8) | payload[offset + 1];
    console.log('ES_info_length: ' + esil);
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
  // console.log(offset, firstPayload);
  const pscp =
    (firstPayload[offset] << 16) |
    (firstPayload[offset + 1] << 8) |
    firstPayload[offset + 2];
  if (pscp === 0x000001) {
    console.warn('parse PES');
    offset += 3;
    console.log('stream_id: ' + firstPayload[offset]);
    pesLen = (firstPayload[offset + 1] << 8) | firstPayload[offset + 2];
    console.log('pes packet length: ' + pesLen);
    offset += 4;
    const pdtsFlag = (firstPayload[offset] & 0xc0) >> 6;
    console.log('PTS_DTS_flags: ' + pdtsFlag);
    offset += 1;
    const pesHdrLen = firstPayload[offset];
    console.log('PES_header_data_length: ' + pesHdrLen);
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
  console.error(`parse pes error,pscp = ${pscp}`);
  console.log(stream.data, stream.size, offset);

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
  console.log('pts,dts: ', pts, dts);
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
  console.warn('parse avc Nal units');
  // console.log(pes.data);
  const buffer = pes.data;
  const len = buffer.byteLength;
  let i = 0;
  let lastUnitStart = 0;
  let units = [];
  let nalStartInPesStart = true;
  let getNalStartIndex = i => {
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

  if (getNalStartIndex(0).index === -1) {
    nalStartInPesStart = false;
  }
  while (i <= len - 4) {
    let { index, is3Or4 } = getNalStartIndex(i);
    if (index !== -1) {
      //去除 pes中nal unit不是开始于第一字节的 开始那部分数据[也可以把这部分数据添加到上一个pes的最后一个nal unit 中]
      if (index !== 0 && nalStartInPesStart) {
        let nalUnit = buffer.subarray(lastUnitStart, i);
        units.push({
          data: nalUnit,
          nalIdc: (nalUnit[0] & 0x60) >> 5,
          nalType: nalUnit[0] & 0x1f
        });
        if ((nalUnit[0] & 0x1f) === 5) {
          console.error('detect IDR');
        }
      }
      lastUnitStart = index + is3Or4;
      i = index + is3Or4 - 1;
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
    if ((last[0] & 0x1f) === 5) {
      console.error('detect IDR');
    }
  }
  if (units.length === 0) {
    // 这个pes中不存在Nal unit,则可能上一个pes的Nal unit还没结束
    // todo: 把这个pes舔到上一个pes的最后一个nal unit中
    console.log('%c pes中不存在 Nal  unit', 'background: #000; color: #ffffff');
  }
  console.log(units);
  return units;
}

function parseAVC(pes) {
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
    return { key: key, pts: pts, dts: dts, units: [] };
  };
  nalUnits.forEach(unit => {
    switch (unit.nalType) {
      case 9:
        if (avcSample) {
          //下一采样【下一帧】开始了，要把这一个采样入track
          console.log('access units order: ', sampleOrder);
          sampleOrder = '';
          pushAvcSample(avcSample);
          console.log(avcTrack);
        }
        sampleOrder += '|AUD ';
        avcSample = createAVCSample(false, pes.pts, pes.dts);
        break;
      case 5:
        sampleOrder += '->IDR ';
        let sliceType = new ExpGolomb(unit.data).readSliceType();
        console.error('IDR sliceType: ', sliceType);
        if (!avcSample) {
          avcSample = createAVCSample(true, pes.pts, pes.dts);
        }
        avcSample.frame = true;
        avcSample.key = true;
        // if (avcTrack.idrFound) {
        //   avcSample.frame = false;
        // }
        // avcTrack.idrFound = true;
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
          console.log('sliceType: ', sliceType);
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
        console.error(`unknow ${unit.nalType}`);
    }
    if (avcSample && [1, 5, 6, 7, 8].includes(unit.nalType)) {
      let units = avcSample.units;
      units.push(unit);
    }
  });
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
  let length = data.byteLength,
    EPBPositions = [],
    i = 1,
    newLength,
    newData;

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

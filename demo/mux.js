console.log('%c mux ', 'background: #222; color: #bada55');

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
  console.log('监测ts流第一个同步字节的位置: ', _probe(buffer));

  for (let i = 0; i < 200; i++) {
    let payload;
    let header;
    let adaptions;
    let adaptionsOffset = 0;
    header = parseTsHeaderInfo(buffer.subarray(188 * i, 188 * i + 4));
    // console.log(buffer.subarray(188 * i, 188 * 32));
    // console.log(`packet ${i + 1}: `, header);
    // console.log(`packet ${i + 1} header: `, _tsPacketHeader(buffer, 188 * i));
    payload = _tsPacketPayload(buffer, 188 * i + 4, 188 * (i + 1));
    // console.log('payload :', payload);
    if (header.adaptationFiledControl === 3) {
      console.warn('detect adaptationFiled');
      adaptions = parseAdaptationFiled(payload);
      adaptionsOffset = adaptions.adaptationLength;
      console.log(adaptions);
    }
    parsePayload(payload, adaptionsOffset, header);
  }
}

function _probe(data) {
  const len = Math.min(1000, data.length - 3 * 188);
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

let pmtId;
let streamInfo;
let avcData;
let audioData;
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
      // first start payload
      if (avcData) {
        console.log('video PES data: ', parsePES(avcData, 0));
      }
      // console.log(avcData);
      avcData = { data: [], size: 0 };
    }
    if (avcData) {
      // normal payload
      let temp = payload.subarray(offset, 188 - 4);
      avcData.data.push(temp);
      avcData.size += temp.length;
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
        result['video'] = ePid;
        break;
      case '0x0f':
        result['audio'] = ePid;
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
    let i;
    for (let j = 0, dataLen = stream.data.length; j < dataLen; j++) {
      frag = stream.data[j];
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
      pesLen -= pesHdrLen + 3;
    }
    return { data: pesData, pts, dts, len: pesLen };
  } else {
    console.error(`parse pes error,pscp = ${pscp}`);
    console.log(stream.data, stream.size, offset);
  }
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
    //have dts
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
  }
  console.log('pts,dts: ', pts, dts);
  return { pts, dts };
}

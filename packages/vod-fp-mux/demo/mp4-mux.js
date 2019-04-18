
console.log('%c mux start!', 'background: #222; color: #bada55');
/**
 *  Carriage of NAL unit structured video in the ISO Base Media File Format
 */

const converBufferToStr = bf => {
  let s = '';
  for (let i = 0; i < bf.byteLength; i++) {
    s += String.fromCharCode(bf[i]);
  }
  return s;
};

const converStrToBuffer = str => {
  const buffer = new Uint8Array(str.length);
  for (let i = 0, len = str.length; i < len; i++) {
    buffer[i] = str.charCodeAt(i);
  }
  return buffer.buffer;
};

const localBfStr = localStorage.getItem('mp4');
if (localBfStr) {
  parse(converStrToBuffer(localBfStr));
}

document.querySelector('#mp4Upload').addEventListener('change', e => {
  const [file] = e.target.files;
  const reader = new FileReader();
  reader.onload = e => {
    const buffer = e.target.result;
    const bfStr = converBufferToStr(new Uint8Array(buffer));
    localStorage.setItem('mp4', bfStr);
    parse(buffer);
  };
  reader.readAsArrayBuffer(file);
});

const Mp4_Types = {
  ftyp: [],
  moof: [],
  moov: [],
  mdat: []
};


Object.keys(Mp4_Types).forEach(type => {
  Mp4_Types[type] = type.split('').map((x, index) => type.charCodeAt(index));
});


/**
 *  ISO base media file format
 *  各种box。第一个必须是 ftyp box
 *  ftyp:
 *      Brands 信息,一个 brand 是四字符codes
 *      两种类型的 brand , [major_brand,compatible_brands]
 */
function parse(buffer) {
  console.log(`--------mp4 parser,${buffer.byteLength}-----------`);
  parseBox(new Uint8Array(buffer));
}


function parseBox(buffer) {
  let boxStore = splitBox(buffer);
  function extractBoxsList(list) {
    list.forEach(box => {
      switch (box.type) {
        case 'ftyp':
        case 'styp':
          box.data = parseFtypBox(box.payload, box.length - 8);
          break;
        case 'moov':
          box.data = splitBox(box.payload);
          extractBoxsList(box.data);
          break;
        case 'mvhd':
          box.data = parseMvhd(box.payload, box.length);
          break;
      }
      // box.payload = null;
      // delete box.payload;
    });
  }
  extractBoxsList(boxStore);
  console.log(boxStore);
}

function splitBox(buffer, offset = 0) {
  let boxStore = [];
  for (let i = 0; i < buffer.byteLength;) {
    const len = getNextFourBytesValue(offset, buffer);
    let box = extractBox(offset, offset + len, buffer);
    boxStore.push(box);
    offset += len;
    i += len;
  }
  return boxStore;
}

function extractBox(start, length, buffer) {
  const box = buffer.subarray(start, length);
  return {
    length: box.byteLength,
    type: getBoxType(4, box),
    payload: box.subarray(8)
  };
}

function getNextFourBytesValue(start, buffer) {
  return buffer[start] * (1 << 24) + buffer[start + 1] * (1 << 16) + buffer[start + 2] * (1 << 8) + buffer[start + 3];
}

function getBoxType(offset, box) {
  return converBufferToStr(box.subarray(offset, offset + 4));
}

function parseFtypBox(payload, length) {
  let offset = 0;
  let ftypBox = {
    compatible: []
  };
  ftypBox.major = getBoxType(offset, payload);
  offset += 4;
  ftypBox.version = getNextFourBytesValue(offset, payload);
  offset += 4;
  let compatible = [];
  for (let i = offset; i < length;) {
    ftypBox.compatible.push(converBufferToStr(payload.subarray(i, i + 4)));
    i += 4;
  }
  return ftypBox;
}


function parseMvhd(payload) {
  /**
    *  mvhd
    *  |----------mvhd---------------|
    *  |--length---version--flags--createtime--modifytime--timescale--duration--rate--volume--xxxxx--next_track_ID--|
    *  |----4--------1-------3--------4------------4-----------4---------4--------4------2-------xx--------4--------|
    */

  let mvhdInfo = {};
  let offset = 0;
  offset += 4;// 略过version[8bit]  flags[24 bit]
  mvhdInfo.createTime = getNextFourBytesValue(offset, payload);
  offset += 4;
  mvhdInfo.modifyTime = getNextFourBytesValue(offset, payload);
  offset += 4;
  mvhdInfo.timescale = getNextFourBytesValue(offset, payload);
  offset += 4;
  mvhdInfo.duration = getNextFourBytesValue(offset, payload);
  offset += 4;
  mvhdInfo.rate = (payload[offset] << 8) | (payload[offset + 1]);
  offset += 4; // end rate
  offset += 2; // end volume
  offset += 2 + 4 * 2 + 4 * 9 + 4 * 6;
  mvhdInfo.nextTrackId = getNextFourBytesValue(offset, payload);
  return mvhdInfo;
}

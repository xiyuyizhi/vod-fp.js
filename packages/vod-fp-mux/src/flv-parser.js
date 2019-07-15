function parseFlv(buffer) {
  console.log(buffer);
  console.log('is flv?', _flvProbe(buffer))
  console.log('header', _parseFlvHead(buffer));
  _parseFlvBody(buffer);
}


function _flvProbe(buffer) {
  return [buffer[0], buffer[1], buffer[2]].map(x => String.fromCharCode(x)).join('') === 'FLV'
}

function _parseFlvHead(buffer) {
  /**
  * head  9 字节
  * 
  * Byte 1-3 FLV
  * Byte 4   version
  * Byte 5
  *       bit 1-5  TypeFlagsReserved (shall be 0)
  *       bit 6    TypeFlagsAudio  1 = audio persent // & 0x04
  *       bit 7    shall be 0
  *       bit 8    TypeFlagsVideo  1 = video persent //  & 0x01
  * Byte 6 - 9     DataOffset   the length of this header in bytes
  *
  */

  return {
    version: buffer[3],
    audio: (buffer[4] & 0x04) >> 2,
    video: (buffer[4] & 0x01)
  }
}

function _parseFlvBody(buffer) {
  let offset = 9;
  offset += 4;
  _parseFlvTag(buffer, offset)

}

function _parseFlvTag(buffer, offset) {
  /**
  *
  * Byte 1
  *       bit 1-2    reserved shoud be 0
  *       bit 3      indicate if the packet are filtered. 0 for unencrypted , 1 for encrypted
  *       bit 4-8    TagType:  8 = audio, 9 = video, 18 = script data
  * Byte  2-4   DataSize : number of bytes after StreamId to end to tag,equal tag.length - 11
  * Byte  5-7   TimeStamp : time in ms at which the data in the tag applies. 
  *                         the value is relative to the first tag in the flv file.
  * Byte 8      TimeStampExtended : 
  * Byte 9-11   StreamID : always 0
  * 
  */
  console.log(buffer[offset]);


}

function _parseAudioTag() {

}

function _parseVideoTag() {

}



export default parseFlv;


## flv 格式

```js

/**
 * https://www.adobe.com/content/dam/acom/en/devnet/flv/video_file_format_spec_v10_1.pdf
 * 
 * FLV 结构:
 * 
 * |  flv header | prevTagSize | tag1 | prevTag1Size | tag2 | prevTag2Size | ......| tagN | prevTagNSize |
 * 
 * FlvHeader(9字节)结构:
 * 
 * F : 第1字节
 * L :  ...
 * V :  ...
 * version : 第4字节
 * TypeFlagsReserved : 第5字节 前5bit 
 * TypeFlagsAudio : 第5字节 bit6  是否有音频
 * TypeFlagsReserved : bit7
 * TypeFlagsVideo : bit8 是否有视频
 * DataOffset : 第6-9字节 header size, 9
 * 
 * 
 * prevTagSize : 4字节 代表上一个tag的长度
 * prevTagSize = TagHeader(11字节) + Tag Payload
 * 
 * flv header 后紧跟的 prevTagSize 值为0
 * 
 * 
 * FlvTag
 * | TagHeader | TagPayload |
 * 
 * TagHeader(11字节)结构:
 * 
 * Reserved : 第一字节 bit 1-2 
 * Filter : bit3  是否需要预处理, 1: 需要预处理(例如 先解密)
 * TagType : bit4-8 取值: 8=audio , 9=video 18= script data
 * DataSize : 3字节 TagPayload的长度
 * Timestamp : 3字节  此tag携带的音、视频帧的pts(单位为ms),值是相对于第一个tag的
 * TimestampExtended : 1字节 扩展timestamp字段,当timestamp3字节存不下数据时用到,代表最高8位,
 * StreamID : 3字节 取值 0 ,无用
 * 
 * TagPayload:
 * 
 *  TagType == 8时 
 *                     header.filter == 1  header.filter == 1
 *    | AudioTagHeader | EncryptionHeader? | FilterParams? | AUDIODATA |
 * 
 *  TagType == 9时 
 *                      filter == 1         filter == 1
 *    | VideoTagHeader | EncryptionHeader? | FilterParams? | VideoDATA |
 * 
 *  TagType == 18时 
 *       filter == 1         filter = 1
 *    | EncryptionHeader? | FilterParams? | ScriptDATA |
 * 
 * 
 * AudioTagHeader结构 (1或2字节):
 * 
 * SoundFormat : bit1-4 表示音频格式。 0:行内pcm数据，平台字节序 3:行内pcm,小端序 10:aac格式 
 * SoundRate : bit5-6  采样率 0=5.5kHz 1=11kHz 2=22kHz  3=44kHz
 * SoundSize : 采样大小 0=8bit 1采样 1=16bit 1采样
 * SoundType : 声道类型 0=单声道 1=立体声
 * AACPacketType : 1字节 如果soundFormat==10 及aac编码格式,则存在这个字节
 *                      0=aac 序列header , 1=aac元数据
 *   
 * 
 * AUDIODATA结构:
 * 
 *    if(flvTag.header.filter===1){
 *        AUDIODATA = EncryptedBody
 *    }else{
 *        if(audioTagHeader.soundFormat ===10 ){
 *          AUDIODATA = AACAudioData
 *        }else{
 *          AUDIODATA = 其他音频格式数据
 *        }
 *    }
 * 
 * AACAudioData结构:
 * 
 *    if(audioTagHeader.aacPacketType==0){
 *        // audioData代表 ISO中定义的AudioSpecificConfig
          *  audioObjectType    5bit
          *  samplingFrquecyIndex   4bit
          *  if(samplingFrquencyIndex === 0xf)
          *     samplingFrequency   24bit
          *  channelConfiguration   4bit |01111000| 
 *    }else{
 *       // audioData代表 原生的aac 帧数据
 *    }
 *    
 * VideoTagHeader结构(AVC格式 5字节):
 * 
 * FrameType : bit 1-4  1=keyFrame  2=inter frame
 * CodecId : bit 5-8  编码器信息  7=AVC
 * AvcPacketType :  1字节  codecId==7时存在   0=avc序列header 1=avc nalU 2=avc end of sequence
 * CompositionTime  : 3字节 codecId==7时存在  取值 0 或者 具体值 单位ms
 * 
 * VIDEODATA结构:
 * 
 *  if(flvTag.header.filter===1){
 *      AUDIODATA = EncryptedBody
 *  }else{
 *      if(videoTagHeader.codecId ===7 ){
 *        VIDEODATA = AVCPACKETDATA
 *      }else{
 *        VIDEODATA = 其他格式
 *      }
 *  }
 * 
 * AVCPACKETDATA结构:
 * 
 * if(videoTagHeader.avcPacketType==0){
 *    // AVCDecoderConfigurationRecord
      *  configurationVerison = 1  uint(8)
      *  avcProfileIndication      uint(8)
      *  profile_compatibility     uint(8)
      *  avcLevelIndication        uint(8)
      *  reserved   `111111`       bit(6)
      *  lengthSizeMinusOne        uint(2)
      *  reserved   `111`          bit(3)
      *  numOfSPS                  uint(5)
      *  for(numOfSPS)
      *    spsLength               uint(16)
      *    spsNALUnit              spsLength个字节
      *  numOfPPS                  uint(8)
      *  for(numOfPPS)
      *     ppsLength              uint(16)
      *     ppsNALUnit             ppsLength个字节
 * }else{
 *    // Nal units数据
 * }
 * 
 */


```

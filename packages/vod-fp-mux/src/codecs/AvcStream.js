import { PipeLine } from 'vod-fp-utility';
import ExpGolomb from '../utils/exp-golomb';
import { getDefaultAVCTrack } from '../default';
import Logger from '../utils/logger';

let logger = new Logger('AvcStream');

export default class AvcStream extends PipeLine {
  constructor() {
    super();
    this.avcTrack = null;
    this.restNaluBuffer = null;
    this.avcSample = null;
  }

  geneTrack(type) {
    if (this.avcTrack === null) {
      this.avcTrack = getDefaultAVCTrack();
    }
    return this.avcTrack;
  }

  push(data) {
    if (data.type === 'video') {
      this.geneTrack('video');
      this.parseAVC(data.pes);
    }
  }

  flush() {
    this.paddingAndPushSample();
    logger.log('avcTrack', this.avcTrack);
    this.emit('data', this.avcTrack);
    this.avcTrack = null;
    this.restNaluBuffer = null;
    this.avcSample = null;
    this.emit('done');
  }

  parseAVC(pes) {
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
    let badNals = false;
    const nalUnits = this.parseAVCNALu(pes);
    pes.data = null;

    // logger.log(nalUnits)
    if (nalUnits.length >= 10) {
      logger.log('应该是一个坏掉的pes,丢弃掉');
      badNals = true;
    }
    let spsFound = false;
    let createAVCSample = function(key, pts, dts, debug) {
      return { key: key, pts: pts, dts: dts, units: [] };
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

    nalUnits.forEach(unit => {
      switch (unit.nalType) {
        case 9:
          if (this.avcSample) {
            // 下一采样【下一帧】开始了，要把这一个采样入track
            this.paddingAndPushSample();
          }
          this.avcSample = createAVCSample(false, pes.pts, pes.dts);
          break;
        case 5:
          logger.warn('detect IDR');
          if (!this.avcSample) {
            this.avcSample = createAVCSample(true, pes.pts, pes.dts);
          }
          this.avcSample.frame = true;
          this.avcSample.key = true;
          this.avcTrack.key = true;
          break;
        case 1:
          if (!this.avcSample) {
            this.avcSample = createAVCSample(true, pes.pts, pes.dts);
          }

          this.avcSample.frame = true;
          // 判断是否为关键帧 only check slice type to detect KF in case SPS found in same packet
          // (any keyframe is preceded by SPS ...)
          if (spsFound && unit.data.length > 4) {
            let sliceType = new ExpGolomb(unit.data).readSliceType();
            if (
              sliceType === 2 ||
              sliceType === 4 ||
              sliceType === 7 ||
              sliceType === 9
            ) {
              this.avcSample.key = true;
            }
          }
          break;
        case 7:
          spsFound = true;
          this.parseSPS(unit);
          break;
        case 8:
          if (!this.avcTrack.pps) {
            this.avcTrack.pps = [unit.data];
          }
          break;
        default:
        // logger.warn(`unknow ${unit.nalType}`);
      }
      if (
        !badNals &&
        this.avcSample &&
        [1, 5, 6, 7, 8].indexOf(unit.nalType) !== -1
      ) {
        let units = this.avcSample.units;
        units.push(unit);
      }
    });
  }

  paddingAndPushSample() {
    if (this.restNaluBuffer) {
      const units = this.avcSample.units;
      if (units.length) {
        const saved = units[units.length - 1].data;
        const newUnit = new Uint8Array(
          saved.byteLength + this.restNaluBuffer.byteLength
        );
        newUnit.set(saved, 0);
        newUnit.set(this.restNaluBuffer, saved.byteLength);
        units[units.length - 1].data = newUnit;
      }
      this.restNaluBuffer = null;
    }
    this.pushAvcSample(this.avcSample);
    this.avcSample = null;
  }

  parseAVCNALu(pes) {
    /**
     * https://en.wikipedia.org/wiki/Network_Abstraction_Layer
     * ISO-14496-10 7.3.1
     *
     *  forbidden_zero_bit  1bit
     *  nal_ref_idc  2bit
     *  nal_unit_type 5bit
     */
    const buffer = pes.data;
    const len = buffer.byteLength;
    let i = 0;
    let lastUnitStart = 0;
    let units = [];
    let nalStartInPesStart = true;
    let getNalUStartIndex = i => {
      let codePrefix3 =
        (buffer[i] << 16) | (buffer[i + 1] << 8) | buffer[i + 2];
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
        }
        if (!nalStartInPesStart) {
          // 属于最新一个采样最后一个nal
          this.restNaluBuffer = buffer.subarray(0, index);
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
      logger.log(
        '%c pes中不存在 Nal  unit',
        'background: #000; color: #ffffff'
      );
    }
    return units;
  }

  pushAvcSample(sample) {
    if (sample && sample.units.length && sample.frame) {
      if (
        sample.key === true ||
        (this.avcTrack.sps && this.avcTrack.samples.length)
      ) {
        this.avcTrack.samples.push(sample);
      }
    }
  }

  parseSPS(unit) {
    if (!this.avcTrack.sps) {
      let expGolombDecoder = new ExpGolomb(unit.data);
      let config = expGolombDecoder.readSPS();
      this.avcTrack.width = config.width;
      this.avcTrack.height = config.height;
      this.avcTrack.pixelRatio = config.pixelRatio;
      this.avcTrack.sps = [unit.data];
      let codecarray = unit.data.subarray(1, 4);
      let codecstring = 'avc1.';
      for (let i = 0; i < 3; i++) {
        let h = codecarray[i].toString(16);
        if (h.length < 2) {
          h = '0' + h;
        }
        codecstring += h;
      }
      this.avcTrack.codec = codecstring;
    }
  }

  discardEPB(data) {
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

    // If no Emulation Prevention Bytes were found just return the original array
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

  insertSampleInOrder(arr, data) {
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
}

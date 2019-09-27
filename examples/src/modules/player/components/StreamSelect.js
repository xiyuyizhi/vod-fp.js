import { useState } from 'react';
import { Select } from 'antd';

const STREAM_LIST = [
  {
    value:
      'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
    label: 'fmp4 with multi tracks'
  },
  {
    value: 'http://asserts.xiyuyizhi.xyz:6660/ts/index.m3u8',
    label: 'hls ts stream'
  },
  {
    value: 'http://asserts.xiyuyizhi.xyz:6660/flv/index.m3u8',
    label: 'hls flv stream'
  },
  {
    value: 'http://asserts.xiyuyizhi.xyz:6660/hls_master/master.m3u8',
    label: 'hls master 木叶丸'
  },
  {
    value: 'http://asserts.xiyuyizhi.xyz:6660/no_audio/index.m3u8',
    label: 'no audio stream'
  },
  {
    value: 'http://asserts.xiyuyizhi.xyz:6660/no_video/index.m3u8',
    label: 'no video stream'
  }
];

export default function StreamSelect(props) {
  const [selected, setStream] = useState(STREAM_LIST[0].value);

  const selectStream = value => {
    setStream(value);
    props.loadSource(value);
  };

  return (
    <div className="item-line">
      <span className="select-stream">select stream :</span>
      <Select value={selected} onChange={selectStream}>
        {STREAM_LIST.map(item => (
          <Select.Option value={item.value} key={item.label}>
            {item.label}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
}

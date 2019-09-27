import { useState, useEffect } from 'react';
import { Input, Button } from 'antd';

export default function StreamInput(props) {
  const [url, setUrl] = useState(props.url);

  const getMediaUrl = e => setUrl(e.target.value);

  return (
    <div className="item-line">
      <Input className="normal_input" value={url} onChange={getMediaUrl} />
      <Button type="primary" onClick={() => props.loadSource(url)}>
        load
      </Button>
      <div className="debug-tips">右键查看 debug 信息、console 查看 log</div>
    </div>
  );
}

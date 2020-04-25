import { useState, useEffect } from 'react';
import {
  Input, Button, Row, Col, Alert
} from 'antd';
import Operates from './components/Operates';
import TsFlvRender from './components/TsFlvRender';
import Mp4Render from './components/Mp4Render';
import './index.less';

function Header() {
  return (
    <h1>
      online parse ts、flv、mp4 format
      <a
        style={{
          fontSize: 16,
          marginLeft: 10
        }}
        href="https://xiyuyizhi.github.io/vod-fp.js"
      >
        return
      </a>
    </h1>
  );
}

export default function Parser() {
  const [format, setFormat] = useState('');
  const [buffer, recieveBuffer] = useState(null);
  const [key, updateKey] = useState(0);

  useEffect(() => {
    updateKey(performance.now());
  }, [buffer]);

  const isMp4 = (f) => !(f === 'ts' || f === 'flv');

  return (
    <div>
      <Row>
        <Col span={6} />
        <Col span={12}>
          <Header></Header>
          <Operates
            updateFormat={setFormat}
            recieveBuffer={recieveBuffer}
          ></Operates>
          <h3>console: window.d</h3>
          <div className="format-show">
            {!isMp4(format) ? (
              <TsFlvRender buffer={buffer} key={key} format={format} />
            ) : null}
            {/mp4/i.test(format) ? (
              <Mp4Render buffer={buffer} key={key} format={format}></Mp4Render>
            ) : null}
          </div>
        </Col>
        <Col span={6} />
      </Row>
    </div>
  );
}

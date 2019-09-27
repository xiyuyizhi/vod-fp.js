import { useState, useEffect, useRef } from 'react';
import Vod from 'vod-fp-player';
import {
  Button, Input, Row, Col, Select, Modal, message
} from 'antd';
import StreamSelect from './components/StreamSelect';
import StreamInput from './components/StreamInput';
import LiveSelect from './components/LiveSelect';
import './index.less';

const STREAM_LIST = [
  {
    value:
      'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
    label: 'fmp4 with multi tracks'
  }
];

function Header() {
  return (
    <h1>
      vod player demo
      <a
        style={{
          fontSize: 16,
          marginLeft: 10
        }}
        href="https://xiyuyizhi.github.io/vod-fp.js/onlineTool"
      >
        online tool
      </a>
    </h1>
  );
}

export default function Player() {
  let vod;
  const [streamUrl, setUrl] = useState(STREAM_LIST[0].value);
  const [error, setError] = useState(null);
  const mediaEle = useRef(null);

  const sourceChanged = url => {
    if (url === streamUrl) {
      // no changed,reload
      _loadNewStream();
    } else {
      setUrl(url || streamUrl);
    }
    setError(null);
  };

  const _loadNewStream = () => {
    if (streamUrl) {
      _destroy();
      _startPlayer(streamUrl);
    }
  };

  const _startPlayer = () => {
    vod = new Vod({
      maxBufferLength: 60,
      maxFlyBufferLength: 60,
      flvLive: streamUrl.indexOf('test.flv') !== -1
    });
    vod.loadSource(streamUrl);
    vod.attachMedia(mediaEle.current);
    vod.useDebug(document.querySelector('#player'));
    vod.on(Vod.Events.ERROR, e => {
      setError(e);
    });
  };

  const _destroy = () => {
    if (vod) {
      vod.offAllEvents();
      vod.destroy();
    }
  };

  useEffect(() => {
    if (!vod) {
      _startPlayer();
    } else {
      _loadNewStream();
    }
    return () => _destroy();
  }, [streamUrl]);

  return (
    <div>
      <Row>
        <Col span={12} offset={6}>
          <Header></Header>
          <StreamSelect loadSource={sourceChanged}></StreamSelect>
          <StreamInput
            loadSource={sourceChanged}
            url={streamUrl}
            key={streamUrl}
          ></StreamInput>
          <LiveSelect loadSource={sourceChanged}></LiveSelect>
          <div id="player">
            <video autoPlay controls width="600" height="400" ref={mediaEle} />
          </div>
          {error ? (
            <div>
              <h1>some error occur...</h1>
              <h4>{JSON.stringify(error)}</h4>
            </div>
          ) : null}
        </Col>
      </Row>
    </div>
  );
}

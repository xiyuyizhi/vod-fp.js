import {useState} from 'react';
import {Modal, Button, message} from 'antd';
import loader from 'utils/loader';

export default function LiveSelect(props) {
  const fetchLiveStream = () => {
    loader('http://api.xiyuyizhi.xyz:7660/startLive', {responseType: 'json'}).then(res => {
      if (res.code) {
        message.error(res.msg);
        return;
      }

      let renderStream = url => {
        return (
          <p>
            {url}
            <Button
              style={{
              marginLeft: 10
            }}
              type="primary"
              onClick={() => {
              Modal.destroyAll();
              props.loadSource(url);
            }}>
              load
            </Button>
          </p>
        );
      };

      Modal.info({title: '直播流地址', width: 480, maskClosable: true, content: (
          <div>
            <div>
              <h4>ts 流</h4>
              {renderStream('http://live.xiyuyizhi.xyz:7660/live/test/index.m3u8')}
            </div>
            <div>
              <h4>http flv</h4>
              {renderStream('http://live.xiyuyizhi.xyz:7660/live/test.flv')}
            </div>
            <div>
              <h4>websocket</h4>
              {renderStream('ws://live.xiyuyizhi.xyz:7660/live/test.flv')}
            </div>
          </div>
        )});
    }).catch(e => {
      message.error(e.message);
    });
  };

  return (
    <div className="item-line">
      <Button type="primary" onClick={fetchLiveStream}>
        生成直播测试流
      </Button>
    </div>
  );
}

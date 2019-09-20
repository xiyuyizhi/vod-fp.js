import Vod from 'vod-fp-player';
import { Button, Input, Row, Col, Select, Modal, message } from 'antd';
import loader from 'utils/loader';
import './index.less';

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

export default class Player extends React.Component {
  constructor(props) {
    super(props);
    this.media = null;
    this.vod = null;
    this.state = {
      selected: STREAM_LIST[0].value,
      url: STREAM_LIST[0].value,
      error: null
    };
    document.cookie = 'debug=base,player';
  }

  // -------------events------------//

  _bindPlayerEvent(player) {
    player.on(Vod.Events.ERROR, e => {
      this.setState({ error: e });
    });
  }

  // input node
  getMediaUrl = e => {
    this.setState({ url: e.target.value });
  };

  // select node
  selectStream = value => {
    this.setState(
      {
        selected: value,
        url: value
      },
      () => this.load()
    );
  };

  // live btn node
  fetchLiveStream = () => {
    loader('http://api.xiyuyizhi.xyz/startLive', { responseType: 'json' })
      .then(res => {
        if (res.code) {
          message.error(res.msg);
          return;
        }

        let renderStream = url => {
          return (
            <p>
              {url}
              <Button
                style={{ marginLeft: 10 }}
                type="primary"
                onClick={() => this.loadLive(url)}
              >
                load
              </Button>
            </p>
          );
        };

        Modal.info({
          title: '直播流地址',
          width: 480,
          maskClosable: true,
          content: (
            <div>
              <div>
                <h4>ts 流</h4>
                {renderStream(res.data.ts)}
              </div>
              <div>
                <h4>http flv</h4>
                {renderStream(res.data.flv)}
              </div>
              <div>
                <h4>websocket</h4>
                {renderStream(res.data.wss)}
              </div>
            </div>
          )
        });
      })
      .catch(e => {
        message.error(e.message);
      });
  };

  loadLive = url => {
    this.setState(
      {
        url: url
      },
      () => {
        Modal.destroyAll();
        this.load();
      }
    );
  };

  load = () => {
    if (this.state.url) {
      this._destroy();
      this.setState({ error: null });
      this._startPlayer(this.state.url);
    }
  };

  _destroy() {
    this.vod.offAllEvents();
    this.vod.destroy();
  }

  _startPlayer(url) {
    let v = new Vod({
      maxBufferLength: 60,
      maxFlyBufferLength: 60,
      flvLive: url.indexOf('test.flv') === -1 ? false : true
    });
    v.loadSource(url);
    v.attachMedia(this.media);
    v.useDebug(document.querySelector('#player'));
    this.vod = v;
    this._bindPlayerEvent(v);
  }

  componentDidMount() {
    this._startPlayer(this.state.url);
  }

  componentWillUnmount() {
    this._destroy();
  }

  render() {
    const { url, error, selected } = this.state;
    return (
      <div>
        <Row>
          <Col span={12} offset={6}>
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
            <div className="item-line">
              <span className="select-stream">select stream :</span>
              <Select value={selected} onChange={this.selectStream}>
                {STREAM_LIST.map(item => (
                  <Select.Option value={item.value} key={item.label}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div className="item-line">
              <Input
                className="normal_input"
                value={url}
                onChange={this.getMediaUrl}
              />
              <Button type="primary" onClick={this.load}>
                load
              </Button>
              <div className="debug-tips">
                右键查看 debug 信息、console 查看 log
              </div>
            </div>
            <div className="item-line">
              <Button type="primary" onClick={this.fetchLiveStream}>
                生成直播测试流
              </Button>
            </div>
            <div id="player">
              <video
                autoPlay
                controls
                width="600"
                height="400"
                ref={media => (this.media = media)}
              />
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

  _renderResolution() {
    let { resolutionList } = this.state;
    if (resolutionList.length) {
      return (
        <select onChange={this.changeResolution}>
          {resolutionList
            .filter(x => x.resolution || x.streamtype)
            .map(({ levelId, streamtype, resolution }) => {
              return (
                <option value={levelId} key={levelId}>
                  {resolution || streamtype}
                </option>
              );
            })}
        </select>
      );
    }
  }
}

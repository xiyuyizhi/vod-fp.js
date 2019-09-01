import Mux from 'vod-fp-mux';
import { Input, Button, Row, Col, Alert } from 'antd';
import TsFlvRender from './TsFlvRender';
import Mp4Render from './Mp4Render';
import loader from 'utils/loader';
import './index.less';

const { Probe } = Mux;

const ProbeList = [
  {
    type: 'ts',
    probe: Probe.tsProbe
  },
  {
    type: 'flv',
    probe: Probe.flvProbe
  },
  {
    type: 'mp4',
    probe: Probe.mp4Probe
  }
];

export default class Parser extends React.Component {
  constructor(props) {
    super(props);
    this.sourceUrl = '';
    this.state = {
      format: '',
      key: 0,
      error: '',
      loading: false
    };
  }

  getUrl = e => {
    this.sourceUrl = e.target.value;
  };

  loadSource = () => {
    if (!this.sourceUrl) return;
    this.setState({ loading: true });
    loader(this.sourceUrl, { responseType: 'arrayBuffer' })
      .then(res => {
        this.setState({ error: '', loading: false });
        this._resolveBuffer(new Uint8Array(res));
      })
      .catch(e => {
        this.setState({ error: e.message, loading: false });
      });
  };

  fileChanged = e => {
    let file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const buffer = new Uint8Array(e.target.result);
      this._resolveBuffer(buffer);
    };
    reader.readAsArrayBuffer(file);
    this.fileEle.value = '';
  };

  _resolveBuffer(buffer) {
    let probe = ProbeList.filter(x => {
      let ret = x.probe(buffer);
      if (/mp4/i.test(ret)) {
        x.type = ret;
      }
      return ret !== -1 && ret;
    }).map(x => x.type);
    if (probe.length) {
      this.setState({
        format: probe[0],
        buffer,
        key: performance.now(),
        error: ''
      });
      return;
    }
    this.setState({ format: '', error: '不支持的视频格式' });
  }

  render() {
    let { format, buffer, key, error, loading } = this.state;
    return (
      <div>
        <Row>
          <Col span={6} />
          <Col span={12}>
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
            <div>
              <Input
                placeholder="eg: find a url of  ts format file from samewhere online"
                className="normal_input"
                onChange={this.getUrl}
              />
              <Button
                type="primary"
                onClick={this.loadSource}
                loading={loading}
              >
                load
              </Button>
            </div>
            <div>
              <div className="upload-tips">or upload from local</div>
              <input
                ref={el => (this.fileEle = el)}
                type="file"
                className="normal_input"
                onChange={this.fileChanged}
              />
            </div>
            <div className="format-show">
              {format === 'ts' || format === 'flv' ? (
                <TsFlvRender buffer={buffer} key={key} format={format} />
              ) : null}
              {/mp4/i.test(format) ? (
                <Mp4Render
                  buffer={buffer}
                  key={key}
                  format={format}
                ></Mp4Render>
              ) : null}
              {error && <Alert message={error} type="error" />}
            </div>
          </Col>
          <Col span={6} />
        </Row>
      </div>
    );
  }
}

import Mux from 'vod-fp-mux';
import {
  Input, Button, Row, Col
} from 'antd';
import TsRender from './TsRender';
import './index.less';

const { Probe } = Mux;

const ProbeList = [{ type: 'ts', probe: Probe.tsProbe }];

export default class Parser extends React.Component {
  constructor(props) {
    super(props);
    this.state = { format: '' };
  }

  fileChanged = e => {
    let file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const buffer = new Uint8Array(e.target.result);
      let pipeline = ProbeList.filter(x => x.probe(buffer) !== -1).map(
        x => x.type
      );
      if (pipeline.length) {
        this.setState({
          format: pipeline[0],
          buffer
        });
        return;
      }
      this.setState({
        format: 'no'
      });
    };
    reader.readAsArrayBuffer(file);
    this.fileEle.value = '';
  };

  render() {
    let { format, buffer } = this.state;
    return (
      <div>
        <Row>
          <Col span={12} offset={6}>
            <h1> online parse ts、fmp4、flv format</h1>
            <div>
              <Input
                placeholder="eg: find a url of  ts format file from samewhere online"
                className="normal_input"
              />
              <Button type="primary">load</Button>
            </div>
            <div>
              <div className="upload-tips"> or upload from local</div>
              <input
                ref={el => (this.fileEle = el)}
                type="file"
                className="normal_input"
                onChange={this.fileChanged}
              />
            </div>
          </Col>
        </Row>
        <Row>
          <Col>Result</Col>
          {format === 'ts' ? <TsRender buffer={buffer} /> : null}
          {format === 'no' && <h2>不能解析</h2>}
        </Row>
      </div>
    );
  }
}

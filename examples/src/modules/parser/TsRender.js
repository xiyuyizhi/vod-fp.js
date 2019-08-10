import Mux from 'vod-fp-mux';
import { Card, Row, Col } from 'antd';

Array.prototype.toString = function () {
  return `[${this.join(',')}]`;
};

export default class TsRender extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tracks: []
    };
    this.tsStringify = new Mux.TsStringify();
    this.bindEvent();
  }

  bindEvent() {
    this.tsStringify.on('data', d => {
      console.log(d);
      this.setState(preState => {
        return {
          tracks: preState.tracks.concat(d)
        };
      });
    });
    this.tsStringify.on('error', e => {
      console.log(e);
    });
  }

  componentDidMount() {
    this.tsStringify.push(this.props.buffer);
    this.tsStringify.flush();
  }

  render() {
    let { tracks } = this.state;
    return (
      <div>
        <Card title="格式: ts">
          <Row>
            {tracks.map(x => {
              return (
                <Col span={8}>
                  <Card title={x.type}>
                    {Object.keys(x).map(key => {
                      if (key !== 'samples' && x[key]) {
                        return (
                          <p key={key}>
                            {`${key}`}:{x[key].toString()}
                          </p>
                        );
                      }
                    })}
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      </div>
    );
  }
}

import Mux from 'vod-fp-mux';
import {
  Card, Row, Col, Button, Alert, Modal
} from 'antd';

Array.prototype.toString = function () {
  return `[${this.join(',')}]`;
};

export default class TsFlvRender extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tracks: [],
      error: null,
      id: -1,
      currentSamples: []
    };
    if (this.props.format === 'ts') {
      this.stringify = new Mux.TsStringify();
    }
    if (this.props.format === 'flv') {
      this.stringify = new Mux.FlvStringify({ live: false });
    }
    this.bindEvent();
  }

  bindEvent() {
    this.stringify.on('data', (d) => {
      if (!d) return;
      this.setState(
        (preState) => {
          return {
            tracks: preState.tracks.concat(d)
          };
        },
        () => {
          window.d = this.state.tracks;
        }
      );
    });
    this.stringify.on('error', (e) => {
      this.setState({ error: e });
    });
  }

  componentDidMount() {
    this.stringify.push(this.props.buffer);
    this.stringify.flush();
  }

  loadSamples(id) {
    this.setState({ id });
    let track = this.state.tracks.filter((x) => x.id === id);
    if (track.length) {
      track = track[0];
      this.setState({ currentSamples: track.samples, id: id });
    }
  }

  _renderTrack(track) {
    if (track.type === 'video') {
      return this._renderVideoCard(track);
    }
    if (track.type === 'audio') {
      return this._renderAudioCard(track);
    }
  }

  _renderVideoCard(track) {
    let {
      id,
      type,
      width,
      height,
      codec,
      timescale,
      profileIdc,
      levelIdc,
      sps,
      pps,
      samples,
      pixelRatio
    } = track;
    return (
      <ul className="track-detail">
        <li>track:{type}</li>
        <li>宽度:{width}</li>
        <li>高度:{height}</li>
        <li>codec:{codec}</li>
        <li>timescale:{timescale}</li>
        <li>profileIdc:{profileIdc}</li>
        <li>levelIdc:{levelIdc}</li>
        <li>pixelRatio:{pixelRatio.toString()}</li>
        <li>pps:{pps && pps.toString()}</li>
        <li>sps:{sps && sps.toString()}</li>
        <li>samples count:{samples.length}</li>
        <li>
          <Button
            type="primary"
            onClick={() => {
              this.loadSamples(id);
            }}
          >
            load samples
          </Button>
        </li>
      </ul>
    );
  }

  _renderAudioCard(track) {
    let {
      id,
      type,
      codec,
      timescale,
      frameDuration,
      config,
      chanel,
      samples,
      adtsObjectType
    } = track;
    return (
      <ul className="track-detail">
        <li>track:{type}</li>
        <li>codec:{codec}</li>
        <li>timescale:{timescale}</li>
        <li>chanel:{chanel}</li>
        <li>adtsObjectType:{adtsObjectType}</li>
        {this.props.format === 'ts' ? (
          <li>frameDuration:{frameDuration.toFixed(2)}</li>
        ) : null}
        <li>config:{config.toString()}</li>
        <li>samples count:{samples.length}</li>
        <li>
          <Button
            type="primary"
            onClick={() => {
              this.loadSamples(id);
            }}
          >
            load samples
          </Button>
        </li>
      </ul>
    );
  }

  _renderSmaples(samples, id) {
    return (
      <div>
        <h2>{id === 1 ? '视频采样数据' : id === 2 ? '音频采样数据' : null}</h2>
        {samples.map((sample) => {
          let key = sample.pts + ':' + sample.dts;
          return sample.key !== undefined ? (
            <div key={key} className="sample">
              pts:{sample.pts + '   '}
              dts:{sample.dts + '   '}
              key: {sample.key ? 'true' : 'false'}
              <span
                style={{
                  marginLeft: 10
                }}
              >
                {`units: [ ${sample.units
                  .map((x) => `nalType: ${x.nalType}`)
                  .join(' , ')} ]`}
              </span>
              {sample.type ? `${sample.type}帧` : null}
            </div>
          ) : (
            <div key={key} className="sample">
              pts:{sample.pts + '   '}
              dts:{sample.dts}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    let {
      tracks, error, currentSamples, id
    } = this.state;
    return (
      <Row>
        <Col span={24}>
          <h1>format: {this.props.format}</h1>
        </Col>
        {tracks.map((track) => {
          return (
            <Col span={12} key={track.type}>
              {this._renderTrack(track)}
            </Col>
          );
        })}
        <Col span={24}>
          {error && <Alert message={error.message} type="error" />}
        </Col>
        <Col span={24}>{this._renderSmaples(currentSamples, id)}</Col>
      </Row>
    );
  }
}

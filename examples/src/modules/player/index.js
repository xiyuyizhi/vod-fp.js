import Vod from 'vod-fp-player';

export default class Player extends React.Component {
  constructor(props) {
    super(props);
    this.media = null;
    this.vod = null;
    this.state = {
      url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
    };
  }

  _startPlayer(url) {
    let v = new Vod({
      maxBufferLength: 60
    });
    v.loadSource(url);
    v.attachMedia(this.media);
    this.vod = v;
  }

  componentDidMount() {
    this._startPlayer(this.state.url);
  }

  componentWillUnmount() {}

  load = () => {};

  getMediaUrl = e => {
    this.setState({
      url: e.target.value
    });
  };

  render() {
    return (
      <div>
        <h1>player demo</h1>
        <div> document.cookie="debug=player" to enable debug on console</div>
        <p>
          <input
            className="url_input"
            value={this.state.url}
            onChange={this.getMediaUrl}
          />
          <button onClick={this.load}>load</button>
        </p>
        <p>
          <video
            autoPlay
            controls
            width="600"
            height="400"
            ref={media => (this.media = media)}
          />
        </p>
      </div>
    );
  }
}

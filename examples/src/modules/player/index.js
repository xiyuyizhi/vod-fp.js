import Vod from 'vod-fp-player';

export default class Player extends React.Component {
  constructor(props) {
    super(props);
    this.media = null;
    this.vod = null;
    this.state = {
      url:
        'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
      resolutionList: [],
      error: null
    };
    document.cookie = 'debug=base,player';
  }

  // -------------events------------//

  _bindPlayerEvent(player) {
    player.on(Vod.Events.ERROR, e => {
      this.setState({
        error: e
      });
    });
    // player.on(Vod.Events.MANIFEST_LOADED, pl => {
    //   // 创建清晰度选项
    //   const { levels } = pl;
    //   if (levels.length > 1) {
    //     this.setState({
    //       resolutionList: levels
    //     });
    //   }
    // });
  }

  changeResolution = e => {
    this.vod.changeLevel(e.target.value);
  };

  load = () => {
    if (this.state.url) {
      this._destroy();
      this.setState({
        resolutionList: [],
        error: null
      });
      this._startPlayer(this.state.url);
    }
  };

  getMediaUrl = e => {
    this.setState({
      url: e.target.value
    });
  };

  _destroy() {
    this.vod.offAllEvents();
    this.vod.destroy();
  }

  _startPlayer(url) {
    let v = new Vod({
      maxBufferLength: 60
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
    const { url, error } = this.state;
    return (
      <div>
        <h1>vod player demo</h1>
        <div>
          <input
            className="url_input"
            value={url}
            onChange={this.getMediaUrl}
          />
          <button onClick={this.load}>load</button>
          <div style={{ transform: 'scale(0.8)', marginTop: '5px' }}>
            右键查看 debug 信息、console 查看 log
          </div>
        </div>
        <div>
          <div id="player">
            <video
              autoPlay
              controls
              width="600"
              height="400"
              ref={media => (this.media = media)}
            />
          </div>
          {/* <div>{this._renderResolution()}</div> */}
        </div>
        {error ? (
          <div>
            <h1>some error occur...</h1>
            <h4>{JSON.stringify(error)}</h4>
          </div>
        ) : null}
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

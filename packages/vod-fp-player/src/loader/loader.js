import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import xhrLoader from './xhr-loader';
import fetchLoader from './fetch-loader';

const DEFAULT_CONFIG = {
  method: 'get',
  url: '',
  body: null,
  useStream: false,
  headers: {},
  options: {},
  params: {
    responseType: 'text',
    timeout: 0
  }
};

const STREAM_DEFAULT_COFNIG = {
  method: 'GET',
  url: '',
  header: {},
  options: {
    mode: 'cors'
  }
};

function loader({ dispatch, connect }, config) {
  return Task.of((resolve, reject) => {
    Task.of((_resolve, _reject) => {
      config.params = config.params || DEFAULT_CONFIG.params;
      config = Object.assign({}, DEFAULT_CONFIG, config);
      let abortable;

      if (window.fetch && window.AbortController) {
        let controller = new AbortController();
        let signal = controller.signal;
        connect(fetchLoader)(config, controller, _resolve, _reject);
        abortable = controller;
      } else {
        abortable = xhrLoader(config, _resolve, _reject);
      }

      dispatch(ACTION.ABORTABLE, {
        id: config.url,
        task: abortable
      });
    })
      .map(x => {
        dispatch(ACTION.REMOVE_ABORTABLE, config.url);
        resolve(x);
      })
      .error(e => {
        dispatch(ACTION.REMOVE_ABORTABLE, config.url);
        reject(e);
      });
  });
}

export default F.curry(loader);

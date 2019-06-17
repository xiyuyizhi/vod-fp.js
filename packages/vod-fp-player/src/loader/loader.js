import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import xhrTask from './xhr';

function loader({ dispatch }, options) {
  return Task.of((resolve, reject) => {
    xhrTask(options, xhr => {
      dispatch(ACTION.ABORTABLE, {
        id: options.url,
        xhr
      });
    })
      .map(x => {
        dispatch(ACTION.REMOVE_ABORTABLE, options.url);
        resolve(x);
      })
      .error(e => {
        dispatch(ACTION.REMOVE_ABORTABLE, options.url);
        reject(e);
      });
  });
}

export default F.curry(loader);

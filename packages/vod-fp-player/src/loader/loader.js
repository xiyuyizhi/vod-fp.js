import { F, Task } from 'vod-fp-utility';
import { ACTION } from '../store';
import fetchTask from './fetch';

function loader({ dispatch }, options) {
  return Task.of((resolve, reject) => {
    fetchTask(options, task => {
      dispatch(ACTION.ABORTABLE, {
        id: options.url,
        task
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

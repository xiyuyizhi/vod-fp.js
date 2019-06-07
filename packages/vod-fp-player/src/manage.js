import { Task, F } from 'vod-fp-utility';
import { ACTION } from './store';
import createMediaSource from './media/media';
import startLoad from './playlist/playlist';
import { startTick } from './tick/tick';
import { curry } from '../../vod-fp-utility/src/fp/core';

function manage({ dispatch, connect }, media, url) {
  let m = connect(createMediaSource)(media);
  let s = connect(startLoad)(url);
  Task.resolve(connect(startTick))
    .ap(s)
    .ap(m)
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      console.log('Error log: ', e);
      dispatch(ACTION.ERROR, e);
    });
}

export default F.curry(manage);

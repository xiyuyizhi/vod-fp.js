import { Task } from 'vod-fp-utility';
import { ACTION } from './store';
import { createMediaSource } from './media/media';
import { startLoad } from './playlist/playlist';
import { startTick } from './tick/tick';
import { curry } from '../../vod-fp-utility/src/fp/core';

function manage(media, url, store) {
  let m = createMediaSource(media);
  let s = startLoad(url);
  Task.resolve(startTick)
    .ap(m)
    .ap(s)
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      console.log('Error log: ', e);
      store.dispatch(ACTION.ERROR, e);
    });
}

export default manage;

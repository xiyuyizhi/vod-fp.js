import { Task } from 'vod-fp-utility';
import { ACTION } from './store';
import { createMediaSource } from './media/media';
import { startLoad } from './playlist/playlist';
import { startTick } from './tick/tick';

function manage(media, url, store) {
  Task.resolve(startTick)
    .ap(createMediaSource(media, store))
    .ap(startLoad(url))
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      console.log(e);
      store.dispatch(ACTION.ERROR, e);
    });
}

export default manage;

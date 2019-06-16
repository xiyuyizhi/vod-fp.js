import { Task, F } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource } from './media/media';
import { loadPlaylist } from './playlist/playlist';
import { startTick } from './tick/tick';

function manage({ dispatch, connect }, media, url) {
  Task.resolve(connect(startTick))
    .ap(connect(loadPlaylist)(url))
    .ap(connect(createMediaSource)(media))
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      dispatch(ACTION.EVENTS.ERROR, e);
      dispatch(ACTION.PROCESS, PROCESS.ERROR);
    });
}

export default F.curry(manage);

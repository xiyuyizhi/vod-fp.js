import { Task, F } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource } from './media/media';
import { loadPlaylist } from './playlist/playlist';
import { startTick } from './tick/tick';

function manage({ dispatch, connect }, media, url) {
  let tick = connect(startTick);
  let m = connect(createMediaSource)(media);
  let s = connect(loadPlaylist)(url);
  Task.resolve(tick)
    .ap(s)
    .ap(m)
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      console.log('Error log: ', e);
      dispatch(ACTION.ERROR, e);
      dispatch(ACTION.PROCESS, PROCESS.ERROR);
    });
}

export default F.curry(manage);

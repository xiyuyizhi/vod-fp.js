import { Task, F } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource } from './media/media';
import { loadPlaylist, changePlaylistLevel } from './playlist/playlist';
import { startTick } from './tick/tick';

function manage({ dispatch, connect }, media, url) {
  Task.resolve(connect(startTick))
    .ap(connect(loadPlaylist)(url))
    .ap(connect(createMediaSource)(media))
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      dispatch(ACTION.PROCESS, PROCESS.ERROR);
      dispatch(ACTION.ERROR, e);
    });
}
function changeLevel({ connect }, levelId) {
  connect(changePlaylistLevel)(levelId);
}

manage = F.curry(manage);
changeLevel = F.curry(changeLevel);

export { manage, changeLevel };

import { Task, F } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource } from './media/media';
import { loadPlaylist, changePlaylistLevel } from './playlist/playlist';
import { startTick } from './tick/tick';
import {
  abortCurrentSegment,
  findSegmentOfCurrentPosition
} from './playlist/segment';
import { flushBuffer } from './buffer/buffer';

function manage({ dispatch, connect }, media, url) {
  Task.resolve(connect(startTick))
    .ap(connect(loadPlaylist)(url))
    .ap(connect(createMediaSource)(media))
    .error(e => {
      // handle 那些非显示 emit 自定义error的运行时异常
      dispatch(ACTION.ERROR, e);
    });
}

function changeLevel() {
  let unSubChanged;
  let unSubChangedError;
  return F.curry(({ connect, getState, dispatch, subscribe }, levelId) => {
    if (unSubChanged && unSubChangedError) {
      unSubChanged();
      unSubChangedError();
    }
    unSubChanged = subscribe(ACTION.EVENTS.LEVEL_CHANGED, levelId => {
      console.log('level changed to ', levelId);
      unSubChanged();
      unSubChangedError();
      let flushStart = connect(findSegmentOfCurrentPosition)
        .map(x => x.start || 0)
        .join();
      connect(flushBuffer)(0, Infinity).map(() => {
        getState(ACTION.MEDIA.MEDIA_ELE).map(x => {
          x.currentTime += 0.005;
          dispatch(ACTION.PROCESS, PROCESS.IDLE);
        });
      });
    });
    unSubChangedError = subscribe(ACTION.EVENTS.LEVEL_CHANGED_ERROR, e => {
      unSubChangedError();
      unSubChanged();
      dispatch(ACTION.PROCESS, PROCESS.IDLE);
    });

    dispatch(ACTION.PROCESS, PROCESS.LEVEL_CHANGING);
    connect(abortCurrentSegment);
    connect(changePlaylistLevel)(levelId);
  });
}

manage = F.curry(manage);

export { manage, changeLevel };

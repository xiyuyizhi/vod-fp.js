import { Task, F, Logger } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource, destroyMediaSource } from './media/media';
import { loadPlaylist, changePlaylistLevel } from './playlist/playlist';
import { startTick } from './tick/tick';
import {
  abortCurrentSegment,
  findSegmentOfCurrentPosition
} from './playlist/segment';
import { flushBuffer, abortBuffer } from './buffer/buffer';

let logger = new Logger('player')

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
      logger.log('level changed to ', levelId);
      unSubChanged();
      unSubChangedError();
      let flushStart = connect(findSegmentOfCurrentPosition)
        .map(x => x.start || 0)
        .join();
      connect(flushBuffer)(flushStart, Infinity).map(() => {
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


function destroy({ connect, dispatch }) {
  logger.log('destroy...')
  connect(abortCurrentSegment);
  connect(abortBuffer);
  connect(destroyMediaSource);
  dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
}

manage = F.curry(manage);
destroy = F.curry(destroy)
export { manage, changeLevel, destroy };

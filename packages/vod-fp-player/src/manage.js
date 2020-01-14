import { Task, F, Logger } from 'vod-fp-utility';
import { ACTION, PROCESS } from './store';
import { createMediaSource, destroyMediaSource } from './media/media';
import { loadPlaylist, changePlaylistLevel } from './playlist/playlist';
import { loadInitMP4 } from './playlist/segment';
import { bootstrap } from './boot/boot';
import {
  abortLoadingSegment,
  findSegmentOfCurrentPosition
} from './playlist/segment';
import { flushBuffer, abortBuffer, bufferBootstrap } from './buffer/buffer';
import { muxBootstrap } from './mux/mux';
import { flvLiveBootstrap, abortFlvLive } from './flv/flv-live';

let logger = new Logger('player');

function manageHls({ dispatch, connect }, media, url) {
  Task.resolve(connect(bootstrap))
    .ap(connect(loadPlaylist)(url))
    .ap(connect(createMediaSource)(media))
    .error(e => {
      dispatch(ACTION.ERROR, e);
    });
}

function manageFlvLive({ dispatch, connect }, media, url) {
  connect(createMediaSource)(media);
  connect(bufferBootstrap);
  connect(muxBootstrap);
  connect(flvLiveBootstrap)(url);
}

// change level from outside
function changeLevel() {
  let unSubChanged;
  let unSubChangedError;
  let unSubProcess;
  return F.curry(
    ({ connect, getState, dispatch, subscribe, subOnce, offSub }, levelId) => {
      offSub(unSubChanged);
      offSub(unSubChangedError);
      offSub(unSubProcess);

      let media = getState(ACTION.MEDIA.MEDIA_ELE);

      unSubChanged = subOnce(ACTION.EVENTS.LEVEL_CHANGED, levelId => {
        dispatch(ACTION.PROCESS, PROCESS.LEVEL_CHANGED);
        logger.log('level changed to ', levelId);
        let flushStart = connect(findSegmentOfCurrentPosition)
          .map(x => x.start || 0)
          .join();
        let resume = () => {
          media.map(x => {
            dispatch(ACTION.PROCESS, PROCESS.IDLE);
            dispatch(ACTION.MAIN_LOOP_HANDLE, 'resume');
            x.play();
          });
        };
        connect(flushBuffer)(flushStart, Infinity).map(() => {
          dispatch(ACTION.FLYBUFFER.REMOVE_SEGMENT_FROM_STORE);
          media.map(m => m.pause());
          if (getState(ACTION.PLAYLIST.FORMAT) === 'fmp4') {
            subOnce(PROCESS.INIT_MP4_LOADED, () => {
              resume();
            });
            connect(loadInitMP4)(levelId.join(), true);
            return;
          }
          resume();
        });
      });

      unSubChangedError = subOnce(ACTION.EVENTS.LEVEL_CHANGED_ERROR, e => {
        dispatch(ACTION.PROCESS, PROCESS.IDLE);
      });

      connect(abortLoadingSegment);
      dispatch(ACTION.MAIN_LOOP_HANDLE, 'stop');
      getState(ACTION.PROCESS).map(pro => {
        if (pro === PROCESS.IDLE) {
          dispatch(ACTION.PROCESS, PROCESS.LEVEL_CHANGING);
          connect(changePlaylistLevel)(levelId);
          return;
        }
        unSubProcess = subOnce(PROCESS.IDLE, pro => {
          dispatch(ACTION.PROCESS, PROCESS.LEVEL_CHANGING);
          connect(changePlaylistLevel)(levelId);
        });
      });
    }
  );
}

function destroy({ connect, dispatch }) {
  logger.log('destroy...');
  connect(abortLoadingSegment);
  connect(abortBuffer);
  connect(abortFlvLive);
  connect(destroyMediaSource);
  dispatch(ACTION.MAIN_LOOP_HANDLE, 'destroy');
  dispatch(ACTION.PLAYLIST.REMOVE_FLUSH_TASK);
}

manageHls = F.curry(manageHls);
manageFlvLive = F.curry(manageFlvLive);
destroy = F.curry(destroy);

export { manageHls, manageFlvLive, changeLevel, destroy };

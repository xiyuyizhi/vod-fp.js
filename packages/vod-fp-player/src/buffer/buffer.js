import { F, Success } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from './buffer-helper';
import { either, Maybe } from '../../../vod-fp-utility/src';

const { map, compose, curry, join, trace } = F;

const bindSourceBufferEvent = curry(
  ({ connect, getState, dispatch }, type, sb) => {
    sb.addEventListener('updateend', function(_) {
      console.log(type + ' buffer update end');
      if (type === 'video') {
        map(x => {
          if (x) {
            // video audio all append
            connect(afterAppended);
          } else {
            dispatch(ACTION.BUFFER.VIDEO_APPENDED, true);
          }
        })(getState(ACTION.BUFFER.AUDIO_APPENDED));
      }
      if (type === 'audio') {
        map(x => {
          if (x) {
            // video audio all append
            connect(afterAppended);
          } else {
            dispatch(ACTION.BUFFER.AUDIO_APPENDED, true);
          }
        })(getState(ACTION.BUFFER.VIDEO_APPENDED));
      }
    });
    sb.addEventListener('error', e => {
      console.log(e.message);
    });
    return sb;
  }
);

const afterAppended = curry(({ getState, dispatch }) => {
  console.log('current sgement appended');
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);
  console.log(getState(ACTION.PLAYLIST.CURRENT_LEVEL));
  console.log(getState(ACTION.PLAYLIST.CURRENT_SEGMENT));
  dispatch(ACTION.PROCESS, PROCESS.IDLE);
  Maybe.of(curry((segments, id) => {}))
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT));
});

function createSourceBuffer({ dispatch, connect }, mediaSource, type, mime) {
  console.log('create source buffer with mime: ', mime);
  let sb = map(
    compose(
      connect(bindSourceBufferEvent)(type),
      ms => ms.addSourceBuffer(mime)
    )
  )(mediaSource);
  if (type === 'video') {
    dispatch(ACTION.BUFFER.VIDEO_SOURCEBUFFER, sb);
  }
  if (type === 'audio') {
    dispatch(ACTION.BUFFER.AUDIO_SOURCEBUFFER, sb);
  }
  return sb;
}

function buffer({ id, getState, subscribe, dispatch, connect }) {
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);
  createSourceBuffer = connect(curry(createSourceBuffer));
  subscribe(ACTION.BUFFER.VIDEO_BUFFER, buffer => {
    let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'video',
        'video/mp4; codecs="avc1.42E01E"'
      );
    });
    compose(
      map(sb => {
        sb.appendBuffer(buffer.value().buffer);
      }),
      Success.of,
      join
    )(sb);
  });

  subscribe(ACTION.BUFFER.AUDIO_BUFFER, buffer => {
    let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'audio',
        'video/mp4; codecs="mp4a.40.2"'
      );
    });
    compose(
      map(sb => sb.appendBuffer(buffer.value().buffer)),
      Success.of,
      join
    )(sb);
  });
}

buffer = F.curry(buffer);

export { buffer };

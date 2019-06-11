import { F, Success, Maybe, either } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { getBufferInfo } from './buffer-helper';

const { map, compose, curry, join, prop, trace } = F;


function bindSourceBufferEvent({ connect, getState, dispatch }, type, sb) {
  const _waitFinished = (other, me) => {
    map(x => {
      if (x) {
        // video audio all append
        connect(afterAppended);
      } else {
        dispatch(me, true);
      }
    })(getState(other));
  }
  sb.addEventListener('updateend', function (_) {
    console.log(type + ' buffer update end');
    if (type === 'video') {
      _waitFinished(ACTION.BUFFER.AUDIO_APPENDED, ACTION.BUFFER.VIDEO_APPENDED)
    }
    if (type === 'audio') {
      _waitFinished(ACTION.BUFFER.VIDEO_APPENDED, ACTION.BUFFER.AUDIO_APPENDED)
    }
  });
  sb.addEventListener('error', e => {
    console.log(e.message);
  });
  return sb;
}
bindSourceBufferEvent = curry(bindSourceBufferEvent)


function afterAppended({ getState, dispatch }) {
  console.log('current sgement appended');
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);
  dispatch(ACTION.PROCESS, PROCESS.IDLE);
  Maybe.of(
    curry((segments, id) => {
      console.log(segments, id);
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID));
}

afterAppended = curry(afterAppended);

// (MediaSource,string,string)  -> Maybe
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
createSourceBuffer = curry(createSourceBuffer);


function buffer({ id, getState, subscribe, dispatch, connect }) {
  let mediaSource = getState(ACTION.MEDIA.MEDIA_SOURCE);
  let append = curry((sb, buffer) => sb.appendBuffer(buffer))
  let doAppend = (sb, bufferInfo) => {
    return Success.of(append)
      .ap(Success.of(sb.join()))
      .ap(
        compose(Success.of, join, map(prop('buffer')))(bufferInfo)
      )
  }

  createSourceBuffer = connect(createSourceBuffer);

  subscribe(ACTION.BUFFER.VIDEO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'video',
        'video/mp4; codecs="avc1.42E01E"'
      );
    });
    either((e) => {
      console.log('error: ', e);
    }, () => { }, doAppend(sb, bufferInfo))

  });
  subscribe(ACTION.BUFFER.AUDIO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'audio',
        'video/mp4; codecs="mp4a.40.2"'
      );
    });
    either((e) => {
      console.log(e);
    }, () => { }, doAppend(sb, bufferInfo))
  });

}

buffer = curry(buffer);

export { buffer };

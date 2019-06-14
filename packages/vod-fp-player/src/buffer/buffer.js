import { F, Success, Maybe, either, maybe } from 'vod-fp-utility';
import { ACTION, PROCESS } from '../store';
import { bufferSerialize, bufferDump } from './buffer-helper';

const { map, compose, curry, join, chain, prop, trace } = F;

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
  };
  sb.addEventListener('updateend', function (_) {
    if (type === 'video') {
      _waitFinished(ACTION.BUFFER.AUDIO_APPENDED, ACTION.BUFFER.VIDEO_APPENDED);
    }
    if (type === 'audio') {
      _waitFinished(ACTION.BUFFER.VIDEO_APPENDED, ACTION.BUFFER.AUDIO_APPENDED);
    }
  });
  sb.addEventListener('error', e => {
    console.log(e.message);
  });
  return sb;
}
bindSourceBufferEvent = curry(bindSourceBufferEvent);

function afterAppended({ getState, dispatch }) {
  dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDED)
  dispatch(ACTION.BUFFER.AUDIO_APPENDED, false);
  dispatch(ACTION.BUFFER.VIDEO_APPENDED, false);
  Maybe.of(
    curry((segments, currentId, videoBufferInfo, audioBufferInfo) => {
      let start = Math.min(videoBufferInfo.startPTS, audioBufferInfo.startPTS);
      start = parseFloat((start / 90000).toFixed(6));
      let end = Math.min(videoBufferInfo.endPTS, audioBufferInfo.endPTS);
      end = parseFloat((end / 90000).toFixed(6));
      segments[currentId].start = start;
      segments[currentId].end = end;
      segments[currentId].duration = end - start;
      console.log('new buffer:', [start, end], bufferDump(getState(ACTION.MEDIA.MEDIA_ELE)));
      let len = segments.length - 1;
      for (let i = currentId + 1; i <= len; i++) {
        segments[i].start = segments[i - 1].end;
        segments[i].end = parseFloat((segments[i].start + segments[i].duration).toFixed(6));
      }
      //清除无用元素
      dispatch(ACTION.BUFFER.VIDEO_BUFFER, null);
      dispatch(ACTION.BUFFER.AUDIO_BUFFER, null);
      dispatch(ACTION.PROCESS, PROCESS.IDLE);
    })
  )
    .ap(getState(ACTION.PLAYLIST.SEGMENTS))
    .ap(getState(ACTION.PLAYLIST.CURRENT_SEGMENT_ID))
    .ap(getState(ACTION.BUFFER.VIDEO_BUFFER))
    .ap(getState(ACTION.BUFFER.AUDIO_BUFFER));
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
  let doAppend = F.curry((sb, bufferInfo) => {
    return Success.of(curry((sb, buffer) => sb.appendBuffer(buffer)))
      .ap(Success.of(sb.join()))
      .ap(
        compose(
          Success.of,
          prop('buffer')
        )(bufferInfo)
      );
  });

  createSourceBuffer = connect(createSourceBuffer);

  subscribe(ACTION.BUFFER.VIDEO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.VIDEO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'video',
        'video/mp4; codecs="avc1.42E01E"'
      );
    });

    either(
      e => {
        console.log('error: ', e);
      },
      () => { },
      chain(doAppend(sb))(bufferInfo)
    );
  });
  subscribe(ACTION.BUFFER.AUDIO_BUFFER, bufferInfo => {
    let sb = getState(ACTION.BUFFER.AUDIO_SOURCEBUFFER).getOrElse(() => {
      return createSourceBuffer(
        mediaSource,
        'audio',
        'video/mp4; codecs="mp4a.40.2"'
      );
    });
    maybe(() => { }, () => {
      dispatch(ACTION.PROCESS, PROCESS.BUFFER_APPENDING)
    }, bufferInfo)

    either(
      e => {
        console.log(e);
      },
      () => { },
      chain(doAppend(sb))(bufferInfo)
    );
  });
}

buffer = curry(buffer);

export { buffer };

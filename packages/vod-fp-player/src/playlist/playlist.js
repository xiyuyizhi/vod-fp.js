import { F, Task } from 'vod-fp-utility';
import { connect, ACTION } from '../store';
import { buffer } from '../buffer/buffer';
import m3u8Parser from '../utils/m3u8-parser';

function playlist(url) {}

function startLoad({ id, dispatch, connect }, url) {
  return Task.of((resolve, reject) => {
    // throw new Error('hhhhh');
    fetch(url)
      .then(res => res.text())
      .then(text => {
        console.log('id', id);
        // connect(buffer);
        buffer(1111);
        resolve(text);
      }, reject);
  }).map(text => {
    dispatch(ACTION.PLAYLIST_LOADED);
    return m3u8Parser(text);
  });
}

startLoad = connect(F.curry(startLoad));

export { startLoad };

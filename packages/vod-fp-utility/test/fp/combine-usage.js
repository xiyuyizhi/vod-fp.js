import { Fail, Success, either, eitherToMaybe } from '../../src/fp/Either';
import { Empty, Just, maybeToEither, Maybe, maybe } from '../../src/fp/Maybe';
import Task from '../../src/fp/Task';
import { F } from '../../src/index.js';
import {
  curry,
  compose,
  chain,
  error,
  join,
  map,
  prop,
  value
} from '../../src/fp/core';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('Fp: combine usage', () => {
  let spy;

  beforeEach(() => {
    spy = chai.spy();
  });

  afterEach(() => {
    spy = null;
  });

  it('# test Either with Task', done => {
    let errorInvalidName = 'invalidFileName';
    let errorReadFlag = 'errorWhenRead';
    let errorUploadFlag = 'errorWhenUpload';
    let successUploadFlag = 'successWhenUpload';

    // readFile :: string -> (Either | Task)
    const readFile = filename => {
      let testInvalidName = filename === errorInvalidName;
      let testErrorWhenReadFile = filename === errorReadFlag;
      let testErrorWhenUpload = filename === errorUploadFlag;

      if (testInvalidName) {
        return Fail.of(errorInvalidName);
      }

      return Task.of((resolve, reject) => {
        setTimeout(() => {
          testErrorWhenReadFile
            ? reject(errorReadFlag)
            : resolve(
                testErrorWhenUpload ? errorUploadFlag : successUploadFlag
              );
        }, 200);
      });
    };

    // httpUpload :: string -> (Task)
    const httpUpload = str => {
      return Task.of((resolve, reject) => {
        setTimeout(() => {
          str === errorUploadFlag
            ? reject(errorUploadFlag)
            : resolve(successUploadFlag);
        }, 300);
      });
    };

    let test1 = compose(
      error(x => {
        x.should.be.equal(errorInvalidName);
        spy.should.be.not.be.called();
      }),
      map(spy),
      map(chain(httpUpload)),
      readFile
    );
    test1(errorInvalidName);

    let test2 = compose(
      error(x => {
        x.should.be.equal(errorReadFlag);
        spy.should.be.not.be.called();
      }),
      map(spy),
      map(chain(httpUpload)),
      readFile
    );
    test2(errorReadFlag);

    let test3 = compose(
      error(x => {
        x.should.be.equal(errorUploadFlag);
        spy.should.be.not.be.called();
      }),
      map(spy),
      map(chain(httpUpload)),
      readFile
    );
    test3(errorUploadFlag);

    readFile(successUploadFlag)
      .chain(httpUpload)
      .map(x => {
        x.should.be.equal(successUploadFlag);
      })
      .error(e => {
        // can handle filnameError、readError、uploadError
        console.log('error:', e);
        // eg: do report
      });

    setTimeout(done, 500);
  });

  it('# test Coordination Motivation ap()', done => {
    let start = Date.now();
    const task1 = Task.of(resolve => setTimeout(() => resolve(2), 800));
    const task2 = Task.of(resolve => setTimeout(() => resolve(1), 300));
    Task.resolve(
      curry((a, b) => {
        let ts = Date.now() - start;
        let closeMaxTime = ts >= 800 && ts <= 815;
        closeMaxTime.should.be.equal(true);
        a.should.be.equal(2);
        b.should.be.equal(1);
        done();
      })
    )
      .ap(task1)
      .ap(task2);
  });

  it('# test transform Maybe ->Either ->Maybe', done => {
    let store = {
      mediaSource: 'MediaSource'
    };
    let spy = chai.spy();
    let errSpy = chai.spy();

    // getState :: string -> Maybe
    let getState = key => Maybe.of(store).map(prop(key));

    let setState = (key, v) => (store[key] = v);

    // createVideoSb :: (Maybe,Boolean) -> (SourceBuffer | undefined)
    let createVideoSb = (mediaSource, errorFlag) => {
      let _doCreate = ms => {
        if (errorFlag) {
          throw new Error('error when create sourceBuffer');
        }
        return 'VideoSourceBuffer';
      };

      let _doStoreSb = sb => {
        setState('videoSb', sb);
        return sb;
      };

      let _create = compose(
        value,
        eitherToMaybe,
        error(errSpy),
        map(_doStoreSb),
        map(_doCreate),
        map(spy),
        maybeToEither
      );
      return _create(mediaSource);
    };

    let ms = getState('mediaSource');
    //第一次调用,模拟createVideoSb出错
    let sb1 = getState('videoSb').getOrElse(() => createVideoSb(ms, true));
    let sb1IsUndefined = sb1 === undefined;
    sb1IsUndefined.should.be.equal(true);
    errSpy.should.be.called.once;
    spy.should.be.called.once;

    //第二次调用,createVideoSb中正常执行
    let sb2 = getState('videoSb').getOrElse(() => createVideoSb(ms));
    sb2.should.be.equal('VideoSourceBuffer');
    errSpy.should.be.called.once;
    spy.should.be.called.twice;

    //第三次调用,直接从store中获取,createVideoSb不执行
    let sb3 = getState('videoSb').getOrElse(() => createVideoSb(ms));
    sb3.should.be.equal('VideoSourceBuffer');
    errSpy.should.be.called.once;
    spy.should.be.called.twice;

    setTimeout(done, 100);
  });

  it('# test transform Task -> Either -> Task', done => {
    // 切换level,1.监测 level details是否存在 2. load level details 3. parse level m3u8
    // 出错场景 1. http 请求阶段出错 2. http 响应内容 m3u8文本解析出错

    let store = {};
    let loadSuccessSpy = chai.spy();
    let changeSuccessSpy = chai.spy();

    let loadErrorFlag = 'loadSourceError';
    let parseM3u8ErrorFlag = 'parseM3u8Error';
    let parseM3u8SuccessFlag = 'parseM3u8Success';

    let getState = key => Maybe.of(store).map(prop(key));
    let setState = (key, v) => (store[key] = v);

    let _doStoreLevels = text => {
      store['levels'] = text;
      return text;
    };

    let _loader = flag => {
      return Task.of((resolve, reject) => {
        setTimeout(
          () => (flag === loadErrorFlag ? reject(flag) : resolve(flag)),
          200
        );
      });
    };

    let parseM3u8 = flag => {
      if (flag === parseM3u8ErrorFlag) {
        return Fail.of(flag);
      }
      return Success.of(flag);
    };

    let loadSource = flag => {
      return _loader(flag)
        .chain(parseM3u8)
        .map(_doStoreLevels)
        .map(x => {
          loadSuccessSpy();
          return x;
        });
    };

    // changePlaylist :: boolean -> (Either(success) | Task)
    let changePlaylist = flag => {
      return maybe(
        () => loadSource(flag),
        () => {
          changeSuccessSpy();
          return Success.of();
        },
        getState('levels')
      );
    };

    changePlaylist(loadErrorFlag).error(e => {
      e.should.be.equal(loadErrorFlag);
      loadSuccessSpy.should.not.be.called();
      changeSuccessSpy.should.not.be.called();
    });

    setTimeout(() => {
      changePlaylist(parseM3u8ErrorFlag).error(e => {
        e.should.be.equal(parseM3u8ErrorFlag);
        changeSuccessSpy.should.not.be.called();
        loadSuccessSpy.should.not.be.called();
      });
    }, 350);

    setTimeout(() => {
      changePlaylist(parseM3u8SuccessFlag).map(x => {
        x.should.be.equal(parseM3u8SuccessFlag);
        loadSuccessSpy.should.be.called.once;
        changeSuccessSpy.should.not.be.called();
      });
    }, 700);

    setTimeout(() => {
      changePlaylist(parseM3u8SuccessFlag).map(x => {
        loadSuccessSpy.should.be.called.once;
        changeSuccessSpy.should.be.called();
        done();
      });
    }, 1000);
  });
});

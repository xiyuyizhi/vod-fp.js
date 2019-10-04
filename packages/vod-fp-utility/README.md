# vod-fp-utility

## fp

> 提供基本的、科里化的工具函数,基本的 Maybe、Either、Task 等 monads

```javascript
npm run test
```

### Maybe

[详细使用参见 unit test](./test/fp/Maybe.js)

```javascript
npm install vod-fp-ulitity --save

import { Maybe,Just,Empty,maybe,maybeToEither } from "vod-fp-utility"

```

Maybe 用于安全的空值监测,有效的解决常规代码中 `a.b.c 由于b属性为undefined或null导致的异常`

Just 和 Empty 为 Maybe 的两个子类,Just 存储非空数据,Empty 对于用于数据上的所有操作不做任何处理,相当于短路

```javascript
Maybe.of(1)
  .map(x => x + 1)
  .map(x => {
    console.log(x); //2
  });
```

```javascript
let store = {
  levels:{
    levelId:1
  }
}

Maybe.of(store)
  .map(prop('levels'))
  .map(prop('details))
  .map(details=>{
    // do someting with details
    // 可以安全的访问details数据
  })

```

```javascript

maybe 工具函数,提供类似 if else的功能

maybe(
  ()=>{
    //levels not exist,do some things,eg: load master m3u8
  },
  levels=>{
    // levels exist,do some things with levels
  },
  Maybe.of(store).map(prop('levels))
)

```

```javascript
Maybe.of(null).getOrElse('default value') // -> default value
Maybe.of(1).getOrElse('default value) // -> 1
```

```javascript
maybeToEither 将maybe类型转换成Either类型 Just -> Success   Empty-> Fail

用于: 首先需要对数据进行非空判断,当值存在时,使用数据进行有关操作,而这个操作可能存在异常发生

let createSb = compose(
  error(()=>{}),// handle error when addSourceBuffer failed
  map(ms=>ms.addSourceBuffer()),// may fail
  maybeToEither,
  map(prop('mediaSource')),
  Maybe.of
)
createSb(store);
// 首先检查store是否存在mediaSource属性,如果存在,执行addSourceBuffer操作并检测异常
// 如果不存在,程序略过所有处理

```

### Either

[详细使用参见 unit test](./test/fp/Either.js)

提供对可能会产生异常的操作的封装

```javascript
import { Success, Fail } from 'vod-fp-utility';
```

```javascript
let successSpy = chai.spy();
let errorSpy = chai.spy();
Success.of(1)
  .map(x => x + a)
  .map(successSpy)
  .error(errorSpy);
errorSpy.should.be.called();
successSpy.should.be.not.called();
```

```javascript
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
          : resolve(testErrorWhenUpload ? errorUploadFlag : successUploadFlag);
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
```

### Task

[详细使用参见 unit test](./test/fp/Task.js)

类似 promise,只不过 .then 换成 .map(), 添加 .error() .ap() .chain() .retry()

```javascript
import { Task } from 'vod-fp-utility';
```

```javascript

Task.resolve(1).map(x=>{
  console.log(x) //1
})

let task1 = Task.of((resolve,reject)=>{
   setTimeout(()=>resolve(1),1000)
})
task1.map(x=>{
  console.log(x) //1
})

let task2 = Task.reject('error')
task2.error(e=>{
  console.log(e) //error
})

//并发操作
let http1 = Task.of((resolve,reject)=>{
  fetch(url1).then(resolve).catch(reject)
})
let http2 = Task.of((resolve,reject)=>{
  fetch(url2).then(resolve).catch(reject)
})
Task.of(curry(d1,d2)=>{
  // get data
})
.ap(http1)
.ap(http2)
.error(e=>{
  // handle error
})

// flatMap
Task.of(resolve => resolve('a'))
  .map(ret => {
    return new Task(resolve => {
      setTimeout(() => {
        resolve(ret + 'b');
      }, 100);
    }).map(ret => ret + 'c');
  })
  .map(ret => ret + 'd')
  .map(ret => {
    ret.should.be.equal('abcd');
    done();
  });

```

## oop

> 提供简单的 eventbus,pipeline,状态管理工具类

### Store

[unit test](./test/oop/store.js)

[详细使用](../vod-fp-player/src/store/index.js)

状态管理,提供类似 react-redux 功能,简化使用,与函数式无缝结合

```javascript
import { combineActions, combineStates, createStore } from 'vod-fp-utility';
```

```javascript

let store = createStore(initState,actions)
let {id,connect,dispatch,getState,getConfig,subscribe.subOnce} = store;

connect:// `将store实例注入科里化后的功能模块函数,始终作为科里化的函数第一个参数`
dispatch:// 执行命令操作,可以是修改store的某个状态,可以是分发某个事件
getState: //从store中获取状态
subscribe:// 订阅某个事件,响应dispatch
getConfig:// 类似getState。只用来获取config配置信息
subOnce://类似subscribe,只监听执行一次


**connect是作为状态管理和函数式结合重要的中间桥梁！！！**

import {initState,ACTIONS} from "./store.js"

const store = createStore(initState,ACTIONS)
const manageHls = curry(({ dispatch, connect }, media, url)=>{
  // 这里,manageHls中可以轻松的从 store中获取state,dispatch动作
  // 通过connect loadPlaylist,createMediaSource等,在loadPlaylist和createMediaSource中
  // 可以同样的和中心store进行交互
  Task.resolve(connect(bootstrap))
    .ap(connect(loadPlaylist)(url))
    .ap(connect(createMediaSource)(media))
    .error(e => {
      dispatch(ACTION.ERROR, e);
    });
})

store.connect(manageHls)(videNode,m3u8Url)

```

### 其他

[fp core](./src/fp/core.js)

[CusError](./src/fp/CusError.js)

[Tick](./src/fp/Tick.js)

[EventBus](./src/oop/EventBus.js)

[Pipeline](./src/oop/Pipeline.js)

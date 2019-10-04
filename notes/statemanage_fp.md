## 函数式+状态管理探索前端开发

## 起因

> 不管是用主流的前端框架业务开发还是在写一些 sdk,通常的编程范式都是面向对象的,尤其 es6 新增 Class 语法糖后，功能模块的划分都基于类的力度。在写过和维护过不少代码后,渐渐觉的在状态复杂的应用中,按局部状态、行为来划分并不能让整体代码结构很清晰,且 js 天生的函数灵活性在类的场景下也很受约束, 所以尝试从函数式的角度来寻找一些突破口。

用了小半年的时间,在自己相对熟悉的音视频领域,采用`函数式编程+状态管理`的编程思路,写了一个简单的 [hls 播放器](https://github.com/xiyuyizhi/vod-fp.js),算是对函数式编程有了一些理解和实践。

## 问题

不管是面向对象还是函数式,十分重要的一点是关注点分离。对于一个关注点、功能点,面向对象主要是实现细节的封装，只对外提供简单的 api 暴露。而对于一个关注点内部,又可分为轻薄的控制层、对状态抽象管理的模型层、具体业务逻辑实现,IO 操作等的服务层。

控制层:是各功能模块之间交互的衔接点,串联在一起实现整体的功能,而功能模块的划分是否合理直接影响这一层的设计。是在 AController 中实例化一个 BController 还是在 CController 中实例化 AController、BController？

模型层: 对状态的管理,对于局部状态,遇到的最多的问题就是`a.b.c,b为undefined的运行时报错`,代码中充斥着大量的防御性检测。更严重的是全局状态,随着应用的复杂,全局状态越来越多,模块依赖其他模块的状态导致需要大量的 getter、setter,a.bInstance.cProp 怎么看都不爽。

服务层: 代码量随着迭代越来越多,代码不容易复用,横跨整个文件的通过 this 对属性的获取和修改

> 面向对象的层级结构设计并不简单、以类为力度划分功能带来了各个模块之间状态,方法的冗余调用、而通过 this 对状态的处理路径也难以跟踪、限制了函数的灵活性

## 函数式

[很好的讲函数式的书](https://github.com/MostlyAdequate/mostly-adequate-guide)

函数式讲究把一个大的功能模块拆分成一个个小的函数,再由这些小函数组合成完整的功能。使用函数来抽象操作和控制流程。

操作: 函数在数学层面代表值的映射`y=f(x)`,在函数式层面重在`引用透明`,即函数内的操作只依赖输入参数,不受其他外部状态影响,保证函数的纯粹性,我认为这是不现实的....,不可能把所有的依赖都以参数的形式传入函数,函数的结果也不只是产生一个新的值。参见下面对状态的管理。

控制流:函数式的强大在我看来在于对控制流的抽象,使得`在对状态的处理过程中(同步的计算逻辑、异步的操作等),能以统一的口径在各个函数中流转,最终产生结果`

> 函数式范式重在思维的转换,由命令式转向声明式,命令式给人的感觉是从一个方法进入另一个方法,层层递进,越来越深,是一种纵向的概念,而`函数式是把所有操作都放在一个水平面上,在同一水平面,数据从一个流程进入下一个流程,是一种横向的概念,包括对同步的处理,异步的处理,产生副作用的IO操作,都抽象在一个维度`

**\*\*\***还是从最基本的看起。。。。\***\*\*\*\***

#### curry+compose

小函数组合成大功能,面临的第一个问题是`参数的数量`, y=f(x) z=f1(t,y) n=f2(z),把 f,f1,f2 组合在一起由参数 x 得到结果 n,中间过程是匹配不上的,那就规定组合的函数都只接受一个参数吧!(对于接受多个参数的函数,通过 curry,暂存前面的参数,转换成只接受最后一个参数的部分函数)

```javascript
const curry = fn => {
  let len = fn.length;
  return function _curry(...args) {
    if (args.length < len) {
      return _curry.bind(null, ...args);
    }
    return fn.apply(null, args);
  };
};

const compose = (...fns) => {
  const fnReversed = fns.reverse();
  return args => {
    return fnReversed.reduce((ret, fn) => fn(ret), args);
  };
};

y=f(x)
z=f1(t,y)
n=f2(z)

--->

let f1_1 = curry(f1)(t);
let getN = compose(
  f2,
  f1_1,
  f
)
getN(x) = n
```

### container

对控制流的处理才是函数式的优雅所在,单纯的函数组合并不能处理复杂的流程,能将控制流与操作抽象在同一水平面,需要借助`容器`的概念,`容器作为输入值的载体,容器上定义一些统一的接口,对输入值应用某些操作,并且数据可以从一种容器进入另一种容器进行进一步操作`

`针对不同的场景,容器又可细分为不同的子类,子类提供统一的接口不同的实现,根据存储值的不同状态,调用相同的API却执行不同操作`

```javascript
class Container {

 constructor(v){
   this._value = v;
 }

 static of(v){
   return new Container(v)
 }

 map(f){
   return new Container(f(this._value))
 }

}

Continer 定义map方法,对存储的值应用一个fn

**对于带有map方法的这一类数据结构叫做 functor,Array 有 map方法,Array就是一个functor**

Container.of(1).map(x=>x+1) --> Container(2)

```

Container 的衍生 Maybe、Either、Task、IO 等

Maybe: 专注处理空值监测,可以很好的处理 a.b.c 的问题

Either: 专注处理异常

Task: 异步处理,类似 Promise

IO: 专注对副作用的处理

### Maybe 的实现

```javascript
class Maybe {
  static of(value) {
    if (value === undefined || value === null) {
      return Empty.of();
    }
    return Just.of(value);
  }
}

class Empty extends Maybe {
  static of(value) {
    return new Empty(value);
  }

  map() {
    return this;
  }
  join() {
    return this;
  }
  chain() {
    return this;
  }
  ap() {
    return this;
  }
  value() {
    return this._value;
  }
  getOrElse(f) {
    if (typeof f === 'function') {
      return f();
    }
    return f;
  }
  toString() {
    return 'Empty';
  }
}

class Just extends Maybe {
  static of(value) {
    return new Just(value);
  }

  map(fn) {
    const v = fn(this._value);
    return Maybe.of(v);
  }

  join() {
    return this.value();
  }

  chain(f) {
    return this.map(f).join();
  }

  ap(f) {
    return f.map(this.value());
  }

  getOrElse(f) {
    let v = this.value();
    if (typeof f === 'function' && v && v.constructor === Empty) {
      return f(v.value());
    }
    return this.value();
  }
}

eg:
Maybe.of(null).map(() => {}); // do nothing
Maybe.of(1).map(x => x + 1); // Maybe(2)

// Just Empty 提供相同的API,对于不同的输入值,空值检测发生在内部,自动选择使用不同的容器,针对对相同的操作,为空时自动略过

eg:
// 处理if逻辑判断
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

> 在实际使用中,我们可以`把所有状态数据存储在中心 store 中,而从 store 中 getState()获取到的数据都是 Maybe 化的`,对数据的操作和子属性的访问通过 map(f),这样可以很好的避免`a.b.c`类的运行时异常

对 Either、Task 等介绍可参见 上文提到的 [很好的讲函数式的书](https://github.com/MostlyAdequate/mostly-adequate-guide),[另 自己对函数式基本组件的封装](https://github.com/xiyuyizhi/vod-fp.js/tree/master/packages/vod-fp-utility)

> curry,在这里主要用于简化函数组合的复杂性,还有延迟执行,部分暂存等用处

> compose,类似于传送带,将数据抽象在同一水平面流转

> 容器,类似于传送带上一个个小盒子,提供统一的接口标准,使数据从一个盒子无缝进入另一个盒子,完成操作和流程控制

## 对状态的管理

> 上面将函数式的处理流程比喻成状态(数据)在传送带上流转,但前端应用是复杂的,我们会有很多条传送带,各传送带之间会有状态的交互,如何能很好的将全局状态分发到各传送带?

在实践中,借鉴了 react-redux 的思想,提供一个中心 Store 的功能,各模块从 store 中 getState,发送命令对 store 中数据进行更新,store 和各函数式模块通过 connect 连接.

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

使用:
import {initState,ACTIONS} from "./store.js"
const store = createStore(initState,ACTIONS)
const manageHls = curry(({ dispatch, connect }, media, url)=>{
  // 这里,manageHls中可以轻松的从 store中获取state,dispatch动作
  // 通过`connect` loadPlaylist,createMediaSource等,在loadPlaylist和createMediaSource中
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

## 函数式的应用

看一个例子

简化的需求背景:

hls 点播播放有标清、高清等档位,切换档位时,1. 先检查档位信息是否存在,2. 不存在要请求档位 m3u8 文件,解析 m3u8 3. 存在的话直接切换

可能存在异常的场景: 1. http 请求失败 2. m3u8 解析失败

```javascript
it('# test transform Task -> Either -> Task', done => {
  let store = {};
  let loadSuccessSpy = chai.spy();
  let changeSuccessSpy = chai.spy();

  let loadErrorFlag = 'loadSourceError';
  let parseM3u8ErrorFlag = 'parseM3u8Error';
  let parsedM3u8Data = 'parsedM3u8Data';

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

  // loadSource :: boolean -> (Task(error) | Either(success|error))
  let loadSource = flag => {
    return _loader(flag)
      .chain(parseM3u8)
      .map(_doStoreLevels)
      .map(x => {
        loadSuccessSpy();
        return x;
      });
  };

  // changePlaylist :: boolean -> (Either(success) | loadSource)
  let changePlaylist = flag => {
    return maybe(
      () => loadSource(flag),
      levels => {
        changeSuccessSpy();
        return Success.of(levels);
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
    changePlaylist(parsedM3u8Data).map(x => {
      x.should.be.equal(parsedM3u8Data);
      loadSuccessSpy.should.be.called.once;
      changeSuccessSpy.should.not.be.called();
    });
  }, 700);

  setTimeout(() => {
    changePlaylist(parsedM3u8Data).map(x => {
      x.should.be.equal(parsedM3u8Data);
      loadSuccessSpy.should.be.called.once;
      changeSuccessSpy.should.be.called();
      done();
    });
  }, 1000);
});
```

## 最后

本文并不能让你对函数式有多少了解,至少我自己目前也只有一些基本的认识（虽然[这本书](https://github.com/MostlyAdequate/mostly-adequate-guide)看了两三遍)）,但函数式的思想还是值得在项目中不断实践的。

[mostly-adequate-guide](https://github.com/MostlyAdequate/mostly-adequate-guide)

[程序员的范畴轮](https://github.com/hmemcpy/milewski-ctfp-pdf)

[vod-fp-utility](https://github.com/xiyuyizhi/vod-fp.js/tree/master/packages/vod-fp-utility)

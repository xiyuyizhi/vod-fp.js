import Task from '../../src/fp/Task';
import {
  compose,
  map,
  split,
  head,
  trace,
  curry,
  liftA2
} from '../../src/fp/core';
import { Success, Fail, either } from '../../src/fp/Either';
import { Maybe } from '../../src/fp/Maybe';
const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('Fp: test Task', function() {
  this.timeout(2000);
  const add = curry((a, b) => a + b);
  let spy;

  beforeEach(() => {
    spy = chai.spy();
  });

  this.afterEach(() => {
    spy = null;
  });

  it('Task.map call', done => {
    Task.of(resolve => resolve(1))
      .map(spy)
      .map(() => {
        spy.should.be.called();
        done();
      });
  });

  it('Task resolve value', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        result.should.be.equal(1);
        done();
      })
      .error(() => {});
  });

  it('Task reject error', done => {
    Task.of((resolve, reject) => reject(1))
      .map(spy)
      .error(err => {
        err.should.be.equal(1);
        spy.should.not.be.called();
      })
      .map(spy)
      .map(() => {
        spy.should.be.called();
        done();
      });
  });

  it('Task.resolve()', done => {
    Task.resolve(1).map(result => {
      result.should.be.equal(1);
      done();
    });
  });

  it('Task.reject()', done => {
    Task.reject(1).error(err => {
      err.should.be.equal(1);
      done();
    });
  });

  it('Task resolve Another Task in map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        return Task.of(resolve => resolve(result + 1));
      })
      .map(result => {
        result.should.be.equal(2);
        done();
      });
  });
  it('Task resolve another async Task in map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        return Task.of(resolve => {
          setTimeout(() => {
            resolve(result + 1);
          }, 100);
        });
      })
      .map(result => {
        result.should.be.equal(2);
        done();
      });
  });

  it('map return another task with map chaind', done => {
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
  });

  it('throw Error on Task.map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        result += a;
      })
      .map(spy)
      .error(err => {
        spy.should.not.be.called();
        err.message.should.be.equal('a is not defined');
        done();
      });
  });

  it('map,compose with Task', done => {
    function add1(v) {
      return v + 1;
    }
    map(
      compose(
        spy,
        add1
      )
    )(Task.of(resolve => resolve(1)));
    setTimeout(() => {
      spy.should.be.called();
    }, 100);

    const read = Task.of(resolve =>
      setTimeout(() => {
        resolve('123');
      }, 300)
    );

    read
      .map(split(' '))
      .map(head)
      .map(result => {
        result.should.be.equal('123');
        done();
      });
  });

  it('ignore compose function when Task return Fail', done => {
    function addThrowError(v) {
      return v + a;
    }
    compose(
      map(spy),
      map(addThrowError)
    )(Task.of(resolve => resolve(1)));
    setTimeout(() => {
      spy.should.not.be.called();
      done();
    }, 100);
  });

  it('Task.cannel()', done => {
    const t = Task.of(resolve =>
      setTimeout(() => {
        resolve();
      }, 500)
    ).map(spy);
    setTimeout(() => t.cancel(), 100);
    setTimeout(() => {
      spy.should.not.be.called();
      done();
    }, 1000);
  });

  it('cancel call all pending task in map', done => {
    const t = Task.of(resolve => setTimeout(() => resolve(), 500)).map(() => {
      return Task.of(resolve => {
        setTimeout(() => resolve(), 800);
      }).map(spy);
    });
    setTimeout(() => {
      //when the task resolved,but the Task in map() not finish
      t.cancel();
    }, 650);

    setTimeout(() => {
      spy.should.not.be.called();
      done();
    }, 1000);
  });

  it('either with Task', done => {
    const task = Task.of((resolve, reject) => resolve(1));
    compose(
      map(either(spy, () => {})),
      map(value => {
        if (value > 5) {
          return Success.of(value);
        }
        return Fail.of(value);
      })
    )(task);

    setTimeout(() => {
      spy.should.be.called();
      done();
    }, 100);
  });

  it('Task.chain()', done => {
    Task.of(resolve => resolve(1))
      .chain(v => Task.of(resolve => resolve(v + 3)))
      .map(v => {
        v.should.be.equal(4);
      });

    Task.of(resolve => resolve(1))
      .chain(v => Task.reject(2))
      .error(v => {
        v.should.be.equal(2);
      });
    setTimeout(done, 200);
  });

  it('Task.ap()', done => {
    Task.resolve(x => x + 3)
      .ap(Task.resolve(2))
      .map(v => {
        v.should.be.equal(5);
      });

    Task.resolve(add)
      .ap(Task.of(2))
      .ap(Task.of(3))
      .map(v => {
        v.should.be.equal(5);
      });

    // 两个ap 中的task 谁先resolve没关系
    Task.resolve(add) // [3,1]
      .ap(
        Task.of(resolve => {
          setTimeout(() => {
            resolve(3);
          }, 100);
        })
      )
      .ap(Task.of(resolve => resolve(1))) // 优先完成依然是add的第二个参数
      .map(v => {
        v.should.be.equal(4);
      });

    Task.resolve(add) //[3,1]
      .ap(Task.of(resolve => resolve(3)))
      .ap(
        Task.of(resolve => {
          setTimeout(() => {
            resolve(1);
          }, 250);
        })
      )
      .map(v => {
        v.should.be.equal(4);
      });

    setTimeout(() => {
      done();
    }, 800);
  });

  it('Task.ap throw error on map', done => {
    const addThree = curry((a, b, c) => a + b + c);
    Task.resolve(addThree)
      .ap(
        Task.of(resolve =>
          setTimeout(() => {
            resolve(1);
          }, 300)
        )
      )
      .ap(
        Task.of((resolve, reject) =>
          setTimeout(() => {
            resolve(2);
          }, 100)
        )
      )
      .ap(Task.of(resolve => resolve(3)))
      .map(v => {
        v.should.be.equal(6);
        console.log(a);
      })
      .error(v => {
        v.message.should.be.equal('a is not defined');
      });
    setTimeout(done, 400);
  });

  it('Task.ap with Fail', done => {
    const anotherSpy1 = chai.spy();
    const anotherSpy2 = chai.spy();
    const anotherSpy3 = chai.spy();
    const anotherSpy4 = chai.spy();
    const anotherSpy5 = chai.spy();
    const anotherSpy6 = chai.spy();
    const anotherSpy7 = chai.spy();
    const anotherSpy8 = chai.spy();

    Task.resolve(add)
      .ap(Task.of(resolve => setTimeout(resolve, 50)))
      .ap(Task.reject('error1'))
      .map(anotherSpy1)
      .error(anotherSpy2);

    Task.resolve(add)
      .ap(Task.of(2))
      .ap(
        Task.of((_, reject) =>
          setTimeout(() => {
            reject('error2');
          }, 10)
        )
      )
      .map(anotherSpy3)
      .error(anotherSpy4);

    Task.resolve(add)
      .ap(Task.reject('error3'))
      .ap(Task.of(resolve => setTimeout(resolve, 50)))
      .map(anotherSpy5)
      .error(anotherSpy6);

    Task.resolve(add)
      .ap(
        Task.of((_, reject) =>
          setTimeout(() => {
            reject('error4');
          }, 10)
        )
      )
      .ap(Task.of(2))
      .map(anotherSpy7)
      .error(anotherSpy8);

    setTimeout(() => {
      anotherSpy1.should.not.be.called();
      anotherSpy2.should.be.called.with('error1');
      anotherSpy3.should.not.be.called();
      anotherSpy4.should.be.called.with('error2');
      anotherSpy5.should.not.be.called();
      anotherSpy6.should.be.called.with('error3');
      anotherSpy7.should.not.be.called();
      anotherSpy8.should.be.called.with('error4');
      done();
    }, 300);
  });

  it('Task with liftA2', done => {
    liftA2(
      add,
      Task.of(resolve => setTimeout(() => resolve(10), 300)),
      Task.of(resolve => {
        setTimeout(() => resolve(20), 150);
      })
    ).map(v => {
      v.should.be.equal(v);
      done();
    });
    const tOfM = compose(
      Task.of,
      Maybe.of
    );
    liftA2(liftA2(add), tOfM('w'), tOfM(' w')).map(v => {
      v.value().should.be.equal('w w');
    });
  });
});

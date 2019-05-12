import Task from '../../src/fp/Task';
import { compose, map, split, head, trace } from '../../src/fp/core';
import { either } from '../../src/fp/Either';
const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('Fp: test Task', function() {
  this.timeout(2000);
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
      })
      .error(err => {
        done();
      });
  });

  it('map return another task with map chaind', done => {
    Task.of(resolve => resolve('a'))
      .map(ret => {
        return new Task(resolve => {
          resolve(ret + 'b');
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
        err.should.be.equal('ReferenceError:a is not defined');
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
});

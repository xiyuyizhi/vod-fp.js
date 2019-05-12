import Task from '../../src/fp/Task';
import { compose, map, split } from '../../src/fp/core';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('test Task', function() {
  this.timeout(5000);
  let spy;

  beforeEach(() => {
    spy = chai.spy();
  });

  this.afterEach(() => {
    spy = null;
  });

  it('Task.map call', done => {
    Task.of(resolve => resolve())
      .map(spy)
      .map(() => {
        spy.should.be.called();
        done();
      });
  });

  it('Task resolve Success', done => {
    Task.of(resolve => resolve(1)).map(result => {
      result.toString().should.be.equal('Success(1)');
      done();
    });
  });
  it('Task reject Fail', done => {
    Task.of((resolve, reject) => reject(1)).map(result => {
      result.toString().should.be.equal('Fail(1)');
      done();
    });
  });

  it('Task resolve Another Task in map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        return Task.of(resolve => resolve(result.value() + 1));
      })
      .map(result => {
        result.toString().should.be.equal('Success(2)');
        done();
      });
  });
  it('Task resolve another async Task in map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        return Task.of(resolve => {
          setTimeout(() => {
            resolve(result.value() + 1);
          }, 1500);
        });
      })
      .map(result => {
        result.toString().should.be.equal('Success(2)');
        done();
      });
  });

  it('map return another task with map chaind', done => {
    Task.of(resolve => resolve('a'))
      .map(ret => {
        return new Task(resolve => {
          resolve(ret.value() + 'b');
        }).map(ret => ret.value() + 'c');
      })
      .map(ret => ret.value() + 'd')
      .map(ret => {
        ret.value().should.be.equal('abcd');
        done();
      });
  });

  it('throw Error on Task.map', done => {
    Task.of(resolve => resolve(1))
      .map(result => {
        result += a;
      })
      .map(result => {
        result.value().should.be.equal('ReferenceError:a is not defined');
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
      done();
    }, 100);
  });

  it('ignore compose function when Task return Fail', done => {
    function addThrowError(v) {
      return v + a;
    }
    map(
      compose(
        spy,
        addThrowError
      )
    )(Task.of(resolve => resolve(1)));

    setTimeout(() => {
      spy.should.not.be.called();
      done();
    }, 100);
  });

  it('Task.resolve()', done => {
    Task.resolve(1).map(result => {
      result.value().should.be.equal(1);
      done();
    });
  });

  it('Task.reject()', done => {
    Task.reject(1).map(err => {
      err.toString().should.be.equal('Fail(1)');
      done();
    });
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

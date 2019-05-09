import Task from '../src/fp/Task';
import { resolve } from 'url';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('test Task', () => {
  it('Task run', done => {
    const spy = chai.spy();
    Task.of(spy);
    spy.should.be.called();
    done();
  });

  it('Task resolve Success instance', done => {
    Task.of(resolve => resolve(1)).map(result => {
      result.toString().should.be.equal('Success(1)');
      done();
    });
  });
  it('Task reject Fail instance', done => {
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
});

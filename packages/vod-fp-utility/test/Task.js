import Task from '../src/fp/Task';

const chai = require('chai');
chai.should();

describe('test Task', () => {
  it('#Task base flow', done => {
    let v;
    Task.of((resolve, reject) => {
      setTimeout(() => resolve(1), 100);
    }).map(value => (v = value));

    setTimeout(() => {
      v.should.be.equal(1);
      done();
    }, 1500);
  });
});

import PipeLine from '../../src/oop/PipeLine';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe('OOp: test PipeLine', function() {
  let pipe1;
  let spy;
  beforeEach(() => {
    pipe1 = new PipeLine();
    spy = chai.spy();
  });

  afterEach(() => {
    pipe1 = null;
    spy = null;
  });

  it('PipeLine push', () => {
    const pipe2 = new PipeLine();
    pipe1.pipe(pipe2);
    pipe2.on('data', spy);
    pipe1.push(1);
    spy.should.be.called.with(1);
  });

  it('Pipeline flush', () => {
    const pipe2 = new PipeLine();
    pipe1.pipe(pipe2);
    pipe2.on('done', spy);
    pipe1.push(1);
    spy.should.not.be.called();
    pipe1.flush();
    spy.should.be.called();
  });

  it('Pipeline multi pipe flow', () => {
    const pipe2 = new PipeLine();
    pipe1.pipe(new PipeLine()).pipe(pipe2);
    pipe2.on('data', spy);
    pipe1.push(1);
    spy.should.be.called();
  });
});

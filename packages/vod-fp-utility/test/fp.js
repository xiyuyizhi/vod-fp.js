import { R } from '../src/index.js';
const chai = require('chai');
chai.should();

describe('test R', () => {
  it('test R.curry()', () => {
    const add = R.curry((a, b) => a + b);
    const add10 = add(10);
    add10(2).should.be.equal(12);
  });

  it('test R.compose()', () => {
    const add = R.compose(
      a => a * a,
      b => b + 2
    );
    add(2).should.be.equal(16);
  });
});

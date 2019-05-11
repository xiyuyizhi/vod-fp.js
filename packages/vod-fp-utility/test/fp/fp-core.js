import { F } from '../../src/index.js';
const chai = require('chai');
chai.should();

describe('test fp base', () => {
  it('test F.curry()', () => {
    const add = F.curry((a, b) => a + b);
    const add10 = add(10);
    add10(2).should.be.equal(12);

    const subtract = F.curry((a, b) => a - b);
    subtract(10, 3).should.be.equal(7);

    const multiParams = F.curry((a, b, c) => a + b + c);
    multiParams(1)(2, 3).should.be.equal(multiParams(1, 2)(3));
  });

  it('test F.compose()', () => {
    const calc = F.compose(
      a => a * a,
      b => b + 2
    );
    calc(2).should.be.equal(16);
  });
});

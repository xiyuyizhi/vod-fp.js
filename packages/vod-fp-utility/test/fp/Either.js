import { Fail, Success, either } from '../../src/fp/Either';
import { F } from '../../src/index.js';
import { curry } from '../../src/fp/core';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();
const { map, prop, compose, join, liftA2 } = F;

describe.only('Fp: test Either', () => {
  function isAgePermit(age) {
    if (age >= 18) {
      return Success.of(age);
    }
    return Fail.of('age is forbid');
  }

  function toNetBar(age) {
    return `age:${age}`;
  }

  it('#Success', () => {
    Success.of('success')
      .toString()
      .should.be.equal('Success("success")');

    compose(
      join,
      map(v => Success.of(v + 1))
    )(Success.of(1))
      .toString()
      .should.be.equal('Success(2)');

    let successSpy = chai.spy();
    let errorSpy = chai.spy();
    Success.of(1)
      .map(x => x + a)
      .map(successSpy)
      .error(errorSpy);
    errorSpy.should.be.called();
    successSpy.should.be.not.called();
  });

  it('#Fail', () => {
    Fail.of('error')
      .toString()
      .should.be.equal('Fail("error")');
  });

  it('#Either base flow', () => {
    compose(
      map(toNetBar),
      isAgePermit
    )(18)
      .toString()
      .should.be.equal(`Success("age:18")`);

    compose(
      map(toNetBar),
      isAgePermit
    )(16)
      .toString()
      .should.be.equal(`Fail("age is forbid")`);
  });

  it('#either', () => {
    let errorValue;
    either(
      error => {
        errorValue = error;
      },
      () => {},
      compose(
        map(toNetBar),
        isAgePermit
      )(16)
    );
    errorValue.should.be.equal('age is forbid');
  });

  it('#Either ap()', () => {
    const add = curry((a, b) => a + b);
    Success.of(add)
      .ap(Success.of(1))
      .ap(Success.of(2))
      .value()
      .should.be.equal(3);

    Success.of(add)
      .ap(Fail.of('error'))
      .ap(Success.of(2))
      .value()
      .should.be.equal('error');

    liftA2(add, Success.of(1), Success.of(2))
      .value()
      .should.be.equal(3);
  });
});

import { Fail, Success, either } from '../src/fp/Either';
import { F } from '../src/index.js';

const chai = require('chai');
chai.should();
const { map, prop, compose } = F;

describe('test Either', () => {
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
});

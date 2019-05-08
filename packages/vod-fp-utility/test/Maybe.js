import Container from '../src/fp/Container.js';
import Maybe from '../src/fp/Maybe.js';
import { F } from '../src/index.js';

const chai = require('chai');
chai.should();
const { map, prop, compose } = F;

describe('test Maybe', () => {
  it('#Maybe base flow', () => {
    Maybe.of(1)
      .toString()
      .should.be.equal('Maybe(1)');

    Maybe.of(null)
      .toString()
      .should.be.equal('Empty');

    map(prop('name'), Maybe.of({ name: 'xx' }))
      .toString()
      .should.be.equal('Maybe("xx")');

    Maybe.of({ name: 'Boris' })
      .map(prop('age'))
      .toString()
      .should.be.equal('Empty');
  });
});

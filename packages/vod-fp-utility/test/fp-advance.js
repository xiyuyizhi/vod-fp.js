import Container from '../src/fp/Container.js';
import Maybe from '../src/fp/Maybe.js';
import { F } from '../src/index.js';
const chai = require('chai');
chai.should();
const { map, prop } = F;

describe('test fp advance', () => {
  it('test Container', () => {
    Container.of(1)
      .toString()
      .should.be.equal('Container(1)');

    Container.of({ name: 'xx' })
      .toString()
      .should.be.equal('Container({"name":"xx"})');

    Container.of(Container.of(1))
      .toString()
      .should.be.equal(`Container(Container(1))`);

    Container.of(
      Container.of({ name: 'xx', age: 12, list: [1, 2, 3], show: true })
    )
      .toString()
      .should.be.equal(
        'Container(Container({"name":"xx","age":12,"list":[1,2,3],"show":true}))'
      );
    Container.of(Container.of(Container.of(123)))
      .toString()
      .should.be.equal(`Container(Container(Container(123)))`);

    Container.of('abc')
      .map(s => s.toUpperCase())
      .toString()
      .should.be.equal(`Container("ABC")`);
  });

  it('test Maybe', () => {
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

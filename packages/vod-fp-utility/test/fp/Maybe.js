import Maybe from '../../src/fp/Maybe.js';
import { F } from '../../src/index.js';

const chai = require('chai');
chai.should();
const {
  map,
  prop,
  join,
  chain,
  compose,
  curry
} = F;

describe('Fp: test Maybe', () => {
  it('#Maybe base flow', () => {
    Maybe
      .of(1)
      .toString()
      .should
      .be
      .equal('Maybe(1)');

    Maybe
      .of(null)
      .toString()
      .should
      .be
      .equal('Empty');

    map(prop('name'), Maybe.of({ name: 'xx' }))
      .toString()
      .should
      .be
      .equal('Maybe("xx")');

    Maybe
      .of({ name: 'Boris' })
      .map(prop('age'))
      .toString()
      .should
      .be
      .equal('Empty');
  });

  it('#Maybe lift use join', () => {

    const safeProp = curry((key, obj) => Maybe.of(obj && obj[key]))
    const safeHead = safeProp(0);

    safeProp('name')({ name: 123 })
      .toString()
      .should
      .be
      .equal('Maybe(123)')

    safeProp('name')({})
      .toString()
      .should
      .be
      .equal('Empty')

    compose(map(safeHead), safeProp('name'))({
      name: [1, 2, 3]
    })
      .toString()
      .should
      .be
      .equal('Maybe(Maybe(1))')

    compose(join, map(safeHead), safeProp('name'))({
      name: [1, 2, 3]
    })
      .toString()
      .should
      .be
      .equal('Maybe(1)')

    compose(join, map(safeHead), safeProp('name'))(null)
      .toString()
      .should
      .be
      .equal('Empty')
  })

  it('#Maybe chain', () => {
    const safeProp = curry((key, obj) => Maybe.of(obj && obj[key]))
    const safeHead = safeProp(0);

    compose(chain(safeHead), safeProp('name'))({
      name: [1, 2, 3]
    })
      .toString()
      .should
      .be
      .equal('Maybe(1)')

    safeProp('name')(null)
      .chain(safeHead)
      .toString()
      .should
      .be
      .equal('Empty')

    Maybe
      .of(1)
      .chain(v => Maybe.of(v + 3))
      .value()
      .should
      .be
      .equal(4)
  })

  it('#Maybe ap', () => {
    const add = curry((a, b) => a + b);
    Maybe
      .of(2)
      .map(add)
      .ap(Maybe.of(3))
      .toString()
      .should
      .be
      .equal('Maybe(5)')

    // F.of(x).map(f) === F.of(f).ap(F.of(x))
    Maybe
      .of(1)
      .map(x => x + 1)
      .value()
      .should
      .be
      .equal(
        Maybe
          .of(x => x + 1)
          .ap(Maybe.of(1))
          .value()
      )

  })

});

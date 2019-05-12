import EventBus from '../../src/oop/EventBus';

const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe.only('test Task', function() {
  let bus;
  let spy;
  beforeEach(() => {
    bus = new EventBus();
    spy = chai.spy();
  });

  afterEach(() => {
    bus = null;
    spy = null;
  });

  it('EventBus.on()', () => {
    bus.on('event1', spy);
    bus.emit('event1');
    spy.should.be.called();
  });

  it('EventBus.once()', () => {
    let i = 0;
    bus.once('event1', () => {
      i += 1;
    });
    bus.emit('event1');
    i.should.be.equal(1);
    bus.emit('event1');
    bus.emit('event1');
    i.should.be.equal(1);
  });

  it('EventBus.off() all handler', () => {
    bus.on('event1', spy);
    bus.off('event1');
    bus.emit('event1');
    spy.should.not.be.called();
  });

  it('EventBus.off special handler', () => {
    const anotherSpay = chai.spy();
    bus.on('event1', spy);
    bus.on('event1', anotherSpay);
    bus.off('event1', spy);
    bus.emit('event1');
    spy.should.not.be.called();
    anotherSpay.should.be.called();
  });

  it('EventBus alias functions', () => {
    const anotherSpay = chai.spy();
    bus.addEventListener('event1', spy);
    bus.on('event1', anotherSpay);
    bus.emit('event1');
    spy.should.be.called();
    anotherSpay.should.be.called();

    bus.removeEventListener('event1', spy);
    bus.emit('event1');
    spy.should.be.called.once;
    anotherSpay.should.be.called.twice;
  });
});

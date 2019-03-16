const chai = require('chai');
chai.should();

describe('## Vod', function() {
  it('test', () => {
    const a = 123;
    a.should.be.equal(123);
    a.should.not.be.null;
  });
});

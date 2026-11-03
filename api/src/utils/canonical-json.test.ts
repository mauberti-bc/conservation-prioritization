import { expect } from 'chai';
import { canonicalizeJson, hashCanonicalJson } from './canonical-json';

describe('canonical-json', () => {
  it('orders nested object keys without changing array order', () => {
    expect(canonicalizeJson({ z: 1, a: { d: 2, b: 1 }, items: [{ y: 2, x: 1 }] })).to.deep.equal({
      a: { b: 1, d: 2 },
      items: [{ x: 1, y: 2 }],
      z: 1
    });
  });

  it('produces the same hash for semantically identical object ordering', () => {
    expect(hashCanonicalJson({ b: 2, a: 1 })).to.equal(hashCanonicalJson({ a: 1, b: 2 }));
  });
});

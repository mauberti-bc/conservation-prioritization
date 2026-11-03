import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { getDbConfig } from './db';

describe('getDbConfig', () => {
  const originalPoolSize = process.env.DB_POOL_SIZE;

  afterEach(() => {
    if (originalPoolSize === undefined) {
      delete process.env.DB_POOL_SIZE;
    } else {
      process.env.DB_POOL_SIZE = originalPoolSize;
    }
  });

  it('uses the configured connection budget', () => {
    process.env.DB_POOL_SIZE = '3';
    expect(getDbConfig().max).to.equal(3);
  });

  it('defaults to five connections when no budget is configured', () => {
    delete process.env.DB_POOL_SIZE;
    expect(getDbConfig().max).to.equal(5);
  });

  for (const value of ['0', '-1', '1.5', 'invalid', 'Infinity', '']) {
    it(`uses the bounded default for invalid pool size ${JSON.stringify(value)}`, () => {
      process.env.DB_POOL_SIZE = value;
      expect(getDbConfig().max).to.equal(5);
    });
  }
});

import { expect } from 'chai';
import pg from 'pg';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getDBConnection, initDBPool } from './db';

describe('database row validation', () => {
  const previousValidation = process.env.DATABASE_RESPONSE_VALIDATION_ENABLED;
  afterEach(() => {
    sinon.restore();
    if (previousValidation === undefined) {
      delete process.env.DATABASE_RESPONSE_VALIDATION_ENABLED;
    } else {
      process.env.DATABASE_RESPONSE_VALIDATION_ENABLED = previousValidation;
    }
  });

  for (const method of ['sql', 'knex'] as const) {
    for (const rows of [[], [{ name: 'member' }], [{ name: 123 }]]) {
      it(`${method} validates each row in ${JSON.stringify(rows)}`, async () => {
        process.env.DATABASE_RESPONSE_VALIDATION_ENABLED = 'true';
        initDBPool();
        const query = sinon.stub().resolves({ rows: [{ api_set_context: 'profile-id' }] });
        sinon.stub(pg.Pool.prototype, 'connect').resolves({ query, release: sinon.stub() } as any);
        const connection = getDBConnection({ sub: 'guid', identity_provider: 'idir' });
        await connection.open();
        query.resolves({ rows, rowCount: rows.length });
        const schema = z.object({ name: z.string() });
        let error: unknown;
        try {
          const result =
            method === 'sql'
              ? await connection.sql(SQL`SELECT name`, schema)
              : await connection.knex(
                  { toSQL: () => ({ toNative: () => ({ sql: 'SELECT name', bindings: [] }) }) } as any,
                  schema
                );
          expect(result.rows).to.deep.equal(rows);
        } catch (caught) {
          error = caught;
        } finally {
          connection.release();
        }
        if (rows.length && typeof rows[0].name !== 'string') {
          expect(error).to.be.instanceOf(Error);
        } else {
          expect(error).to.equal(undefined);
        }
      });
    }
  }
});

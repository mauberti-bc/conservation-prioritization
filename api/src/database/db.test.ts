import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import * as pg from 'pg';
import Sinon, { SinonSandbox, SinonStub } from 'sinon';
import SQL from 'sql-template-strings';
import { IDENTITY_SOURCE } from '../constants/database';
import { Profile } from '../models/profile';
import { getMockDBConnection } from '../__mocks__/db';
import * as db from './db';
import {
  DB_CLIENT,
  getAPIUserDBConnection,
  getDBConnection,
  getDBPool,
  getKnex,
  getKnexQueryBuilder,
  getServiceAccountDBConnection,
  IDBConnection,
  initDBPool
} from './db';

describe('db', () => {
  describe('getDBPool', () => {
    it('returns undefined if pool not initialized', () => {
      const pool = getDBPool();
      expect(pool).to.be.undefined;
    });

    it('returns defined pool if initialized', () => {
      initDBPool();
      const pool = getDBPool();
      expect(pool).not.to.be.undefined;
    });
  });

  describe('getDBConnection', () => {
    it('throws error if keycloak token is undefined', () => {
      expect(() => getDBConnection(null as unknown as object)).to.throw('Keycloak token is undefined');
    });

    it('returns a database connection instance', () => {
      const connection = getDBConnection({});
      expect(connection).not.to.be.null;
    });

    describe('DBConnection instance methods', () => {
      let sinonSandbox: SinonSandbox;
      let mockKeycloakToken: object;
      let queryStub: SinonStub;
      let releaseStub: SinonStub;
      let mockClient: { query: SinonStub; release: SinonStub };
      let connectStub: SinonStub;
      let mockPool: { connect: SinonStub };
      let connection: IDBConnection;

      beforeEach(() => {
        sinonSandbox = Sinon.createSandbox();

        mockKeycloakToken = {
          preferred_username: 'testguid@idir',
          idir_username: 'testuser',
          identity_provider: IDENTITY_SOURCE.IDIR
        };

        queryStub = sinonSandbox.stub().resolves({ rows: [{ api_set_context: 123 }] });
        releaseStub = sinonSandbox.stub();
        mockClient = { query: queryStub, release: releaseStub };
        connectStub = sinonSandbox.stub().resolves(mockClient);
        mockPool = { connect: connectStub };
        connection = getDBConnection(mockKeycloakToken);
      });

      afterEach(() => {
        sinonSandbox.restore();
      });

      describe('open', () => {
        it('opens connection, sets user context, begins transaction', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);

          await connection.open();

          const expectedSQL = SQL`select api_set_context(${'testguid'}, ${IDENTITY_SOURCE.IDIR});`;

          expect(queryStub).to.have.been.calledWith(expectedSQL.text, expectedSQL.values);
          expect(queryStub).to.have.been.calledWith('BEGIN');
        });

        it('does nothing if already open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);

          await connection.open();
          queryStub.resetHistory();
          connectStub.resetHistory();

          await connection.open();

          expect(connectStub).not.to.have.been.called;
          expect(queryStub).not.to.have.been.called;
        });

        it('throws error if pool not initialized', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(undefined);

          let error: any;
          try {
            await connection.open();
          } catch (err) {
            error = err;
          }

          expect(error).to.exist;
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBPool is not initialized' });
        });
      });

      describe('release', () => {
        it('releases connection when open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          connection.release();
          expect(releaseStub).to.have.been.calledOnce;
        });

        it('does nothing if already released', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          connection.release();
          releaseStub.resetHistory();
          connection.release();
          expect(releaseStub).not.to.have.been.called;
        });

        it('does nothing if not open', () => {
          connection.release();
          expect(releaseStub).not.to.have.been.called;
        });
      });

      describe('commit', () => {
        it('sends COMMIT when open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          await connection.commit();
          expect(queryStub).to.have.been.calledWith('COMMIT');
        });

        it('throws error if not open', async () => {
          let error: any;
          try {
            await connection.commit();
          } catch (err) {
            error = err;
          }
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection is not open' });
        });
      });

      describe('rollback', () => {
        it('sends ROLLBACK when open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          await connection.rollback();
          expect(queryStub).to.have.been.calledWith('ROLLBACK');
        });

        it('throws error if not open', async () => {
          let error: any;
          try {
            await connection.rollback();
          } catch (err) {
            error = err;
          }
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection is not open' });
        });
      });

      describe('query', () => {
        it('sends query when open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          await connection.query('SELECT 1');
          expect(queryStub).to.have.been.calledWith('SELECT 1', []);
        });

        it('throws error if not open', async () => {
          let error: any;
          try {
            await connection.query('SELECT 1');
          } catch (err) {
            error = err;
          }
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection is not open' });
        });
      });

      describe('sql', () => {
        it('sends sql statement when open', async () => {
          sinonSandbox.stub(db, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          await connection.open();
          const sqlStatement = SQL`SELECT ${1}`;
          await connection.sql(sqlStatement);
          expect(queryStub).to.have.been.calledWith('SELECT $1', [1]);
        });

        it('throws error if not open', async () => {
          let error: any;
          try {
            const sqlStatement = SQL`SELECT ${1}`;
            await connection.sql(sqlStatement);
          } catch (err) {
            error = err;
          }
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection is not open' });
        });
      });
    });
  });

  describe('getAPIUserDBConnection', () => {
    it('calls getDBConnection for API user', () => {
      const mockDBConnection = getMockDBConnection();
      const stub = Sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      getAPIUserDBConnection();

      expect(stub).to.have.been.calledWith({
        preferred_username: `${process.env.DB_USER_API}@${IDENTITY_SOURCE.DATABASE}`,
        identity_provider: IDENTITY_SOURCE.DATABASE
      });

      stub.restore();
    });
  });

  describe('getServiceAccountDBConnection', () => {
    it('calls getDBConnection for service account user', () => {
      const mockDBConnection = getMockDBConnection();
      const stub = Sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const systemUser: Profile = {
        profile_id: '1',
        identity_source: 'IDIR',
        profile_identifier: 'sims-svc-4464',
        profile_guid: 'service-account-sims-svc-4464'
      };

      getServiceAccountDBConnection(systemUser);

      expect(stub).to.have.been.calledWith({
        preferred_username: 'service-account-sims-svc-4464',
        identity_provider: IDENTITY_SOURCE.SYSTEM
      });

      stub.restore();
    });
  });

  describe('getKnexQueryBuilder', () => {
    it('returns a Knex query builder', () => {
      const queryBuilder = getKnexQueryBuilder();
      expect(queryBuilder.client.config).to.eql({ client: DB_CLIENT });
    });
  });

  describe('getKnex', () => {
    it('returns a Knex instance', () => {
      const knex = getKnex();
      expect(knex.client.config).to.eql({ client: DB_CLIENT });
    });
  });
});

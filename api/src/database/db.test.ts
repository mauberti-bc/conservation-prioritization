import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import * as pg from 'pg';
import Sinon, { SinonSandbox, SinonStub } from 'sinon';
import SQL from 'sql-template-strings';
import { IDENTITY_SOURCE } from '../constants/database';
import { Profile } from '../models/profile';
import { setProfileContextSQL } from '../queries/database/user-context-queries';
import { getMockDBConnection } from '../__mocks__/db';
import * as db from './db';
import {
  getAPIUserDBConnection,
  getDBConnection,
  getDBPool,
  getServiceAccountDBConnection,
  IDBConnection,
  initDBPool
} from './db';

describe('db', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('getDBPool', () => {
    it('throws if pool not initialized', async () => {
      // The pool is a module-level singleton that other test files may already have
      // initialized, so load a fresh copy of the module for this assertion.
      const modulePath = require.resolve('./db');
      const cachedModule = require.cache[modulePath];
      delete require.cache[modulePath];

      try {
        const freshDb = await import('./db');
        expect(() => freshDb.getDBPool()).to.throw('DBPool is not initialized');
      } finally {
        require.cache[modulePath] = cachedModule;
      }
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

    it('throws error if the token has no user identifier', () => {
      expect(() => getDBConnection({})).to.throw('User identifier is required');
    });

    it('returns a database connection instance', () => {
      const connection = getDBConnection({
        preferred_username: 'testguid@idir',
        identity_provider: IDENTITY_SOURCE.IDIR
      });
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

          const expectedSQL = setProfileContextSQL('testguid', IDENTITY_SOURCE.IDIR);

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
          sinonSandbox.stub(db, 'getDBPool').throws(new Error('DBPool is not initialized'));

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
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection not open' });
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
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection not open' });
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
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection not open' });
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
          expect(error.errors[0]).to.eql({ name: 'Error', message: 'DBConnection not open' });
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
    });
  });

  describe('getServiceAccountDBConnection', () => {
    it('calls getDBConnection for service account user', () => {
      const mockDBConnection = getMockDBConnection();
      const stub = Sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const systemUser: Profile = {
        profile_id: '1',
        identity_source: 'IDIR',
        profile_identifier: 'conservation-svc-4464',
        profile_guid: 'service-account-conservation-svc-4464'
      };

      getServiceAccountDBConnection(systemUser);

      expect(stub).to.have.been.calledWith({
        preferred_username: `service-account-conservation-svc-4464@${IDENTITY_SOURCE.SYSTEM}`,
        identity_provider: IDENTITY_SOURCE.SYSTEM
      });
    });
  });
});

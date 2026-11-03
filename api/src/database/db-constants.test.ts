import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon, { SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import * as db from './db';
import { getDBConstants, initDBConstants } from './db-constants';

chai.use(sinonChai);

describe('db-constants', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('when DBConstants has not been initialized', () => {
    describe('initDBConstants', () => {
      it('catches and re-throws an error', async () => {
        const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').throws(new Error('test error'));

        try {
          await initDBConstants();
          expect.fail('Expected error to be thrown');
        } catch (actualError) {
          expect((actualError as Error).message).to.equal('test error');
          expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
        }
      });
    });

    describe('getDBConstants', () => {
      it('throws an error if DBConstants has not been initialized', () => {
        try {
          getDBConstants();
          expect.fail('Expected error to be thrown');
        } catch (actualError) {
          expect((actualError as Error).message).to.equal('DBConstants is not initialized');
        }
      });
    });
  });

  describe('when DBConstants has been initialized', () => {
    let dbConnectionObj: db.IDBConnection;
    let getAPIUserDBConnectionStub: SinonStub<[], db.IDBConnection>;

    before(async () => {
      // Mock query response using the updated "profile" table fields
      const mockQueryResponse: QueryResult<any> = {
        rowCount: 1,
        rows: [
          {
            profile_id: '1',
            profile_identity_source_id: 2,
            profile_identifier: '123',
            profile_guid: 'service-account-123',
            record_effective_date: '',
            record_end_date: '',
            created_at: '2025-12-12',
            create_user: 1,
            updated_at: null,
            update_user: null,
            revision_count: 0
          }
        ],
        command: '',
        oid: 0,
        fields: []
      };

      dbConnectionObj = getMockDBConnection({
        open: sinon.stub().resolves(),
        commit: sinon.stub().resolves(),
        release: sinon.stub().resolves(),
        sql: sinon.stub().resolves(mockQueryResponse)
      });

      getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      await initDBConstants();
    });

    describe('initDBConstants', () => {
      it('does nothing if DBConstants has already been initialized', async () => {
        expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;

        // Call init a second time
        await initDBConstants();

        // Expect it not to have been called again
        expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      });
    });

    describe('getDBConstants', () => {
      it('returns a defined DBConstants instance if it has been initialized', () => {
        const dbConstants = getDBConstants();
        expect(dbConstants).not.to.be.undefined;
        expect(dbConstants.serviceClientUsers).to.have.lengthOf(1);
      });
    });
  });
});

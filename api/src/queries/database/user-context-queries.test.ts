import { expect } from 'chai';
import { describe } from 'mocha';
import { IDENTITY_SOURCE } from '../../constants/database';
import { setProfileContextSQL } from './user-context-queries';

describe('setProfileContextSQL', () => {
  it('throws when the user identifier is empty', () => {
    expect(() => setProfileContextSQL('', IDENTITY_SOURCE.IDIR)).to.throw('setProfileContextSQL: userGuid is required');
  });

  it('throws when the identity source is missing', () => {
    expect(() => setProfileContextSQL('idir-user', undefined as unknown as IDENTITY_SOURCE)).to.throw(
      'setProfileContextSQL: systemUserType is required'
    );
  });

  it('identifies an IDIR user', () => {
    const response = setProfileContextSQL('idir-user', IDENTITY_SOURCE.IDIR);

    expect(response).not.to.be.null;
  });

  it('identifies an Azure IDIR user', () => {
    const response = setProfileContextSQL('azure-idir-user', IDENTITY_SOURCE.AZURE_IDIR);

    expect(response).not.to.be.null;
  });

  it('identifies a database user', () => {
    const response = setProfileContextSQL('database-user', IDENTITY_SOURCE.DATABASE);

    expect(response).not.to.be.null;
  });

  it('identifies a system user', () => {
    const response = setProfileContextSQL('system-user', IDENTITY_SOURCE.SYSTEM);

    expect(response).not.to.be.null;
  });
});

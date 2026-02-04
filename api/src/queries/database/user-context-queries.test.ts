import { expect } from 'chai';
import { describe } from 'mocha';
import { IDENTITY_SOURCE } from '../../constants/database';
import { setProfileContextSQL } from './user-context-queries';

describe('setProfileContextSQL', () => {
  it('has empty userIdentifier', () => {
    const response = setProfileContextSQL('', IDENTITY_SOURCE.IDIR);

    expect(response).to.be.null;
  });

  it('identifies an IDIR user', () => {
    const response = setProfileContextSQL('idir-user', IDENTITY_SOURCE.IDIR);

    expect(response).not.to.be.null;
  });

  it('identifies a BCEID basic user', () => {
    const response = setProfileContextSQL('bceid-basic-user', IDENTITY_SOURCE.BCEID_BASIC);

    expect(response).not.to.be.null;
  });

  it('identifies a BCEID business user', () => {
    const response = setProfileContextSQL('bceid-business-user', IDENTITY_SOURCE.BCEID_BUSINESS);

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

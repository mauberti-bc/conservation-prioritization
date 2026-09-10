import { expect } from 'chai';
import sinon from 'sinon';
import { SYSTEM_ROLE } from '../constants/roles';
import { Profile, UpsertProfile } from '../models/profile';
import { ProfileRepository } from '../repositories/profile-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ProfileService } from './profile-service';

describe('profile self-registration', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates a missing user with the member role and reuses the profile on subsequent logins', async () => {
    const payload: UpsertProfile = {
      profile_guid: 'new-user-guid',
      profile_identifier: 'new-user',
      identity_source: 'azureidir',
      display_name: 'New User',
      email: null,
      given_name: null,
      family_name: null,
      agency: null,
      notes: null
    };
    const profile: Profile = {
      ...payload,
      profile_id: '11111111-1111-4111-8111-111111111111',
      role_id: '22222222-2222-4222-8222-222222222222',
      role_name: SYSTEM_ROLE.MEMBER
    };
    const findProfile = sinon.stub(ProfileRepository.prototype, 'findProfileByGuid');
    findProfile.onFirstCall().resolves(null);
    findProfile.onSecondCall().resolves(profile);
    const roleLookup = sinon.stub(ProfileRepository.prototype, 'getRoleIdByNameAndScope').resolves(profile.role_id!);
    const createProfile = sinon.stub(ProfileRepository.prototype, 'createProfile').resolves(profile);
    const updateProfile = sinon.stub(ProfileRepository.prototype, 'updateProfile');
    const service = new ProfileService(getMockDBConnection());

    expect(await service.upsertProfile(payload)).to.deep.equal([profile, true]);
    expect(roleLookup.calledOnceWithExactly(SYSTEM_ROLE.MEMBER, 'profile')).to.equal(true);
    expect(createProfile.calledOnceWithExactly({ ...payload, role_id: profile.role_id })).to.equal(true);

    expect(await service.upsertProfile(payload)).to.deep.equal([profile, false]);
    expect(createProfile.calledOnce).to.equal(true);
    expect(updateProfile.notCalled).to.equal(true);
  });
});

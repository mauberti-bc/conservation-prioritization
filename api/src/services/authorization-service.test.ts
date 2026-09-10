import { expect } from 'chai';
import sinon from 'sinon';
import { Profile } from '../models/profile';
import { getMockDBConnection } from '../__mocks__/db';
import { AuthorizationService } from './authorization-service';
import { PROJECT_ROLE } from './authorization-service.interface';
import { ProfileService } from './profile-service';
import { ProjectProfileService } from './project-profile-service';
import { ProjectService } from './project-service';

describe('project authorization', () => {
  afterEach(() => {
    sinon.restore();
  });

  for (const role of [PROJECT_ROLE.PROJECT_ADMIN, null]) {
    it(`resolves the database profile ID and ${role ? 'allows an owner' : 'denies a non-member'}`, async () => {
      sinon.stub(ProjectService.prototype, 'getProjectById').resolves({ project_id: 'project' } as any);
      sinon
        .stub(ProfileService.prototype, 'findProfileByGuid')
        .withArgs('token-guid')
        .resolves({ profile_id: 'profile-id' } as Profile);
      const lookup = sinon
        .stub(ProjectProfileService.prototype, 'getRoleForProjectProfile')
        .withArgs('project', 'profile-id')
        .resolves(role);
      const service = new AuthorizationService(getMockDBConnection(), { keycloakToken: { sub: 'token-guid' } });
      const allowed = await service.executeAuthorizationScheme({
        and: [{ discriminator: 'Project', projectId: 'project', validProjectRoles: [PROJECT_ROLE.PROJECT_ADMIN] }]
      });
      expect(allowed).to.equal(Boolean(role));
      expect(lookup.calledOnce).to.equal(true);
    });
  }
});

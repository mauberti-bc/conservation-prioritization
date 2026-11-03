import { IDBConnection } from '../database/db';
import { CreateProject, DeleteProject, Project, UpdateProject } from '../models/project';
import { ProfileRepository } from '../repositories/profile-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { ProjectPermissionService } from '../services/project-permission-service';
import { ProjectProfileService } from '../services/project-profile-service';
import { generateHexColourFromSeed } from '../utils/colour';
import { normalizeInviteEmails } from '../utils/invite';
import { PROJECT_ROLE } from './authorization-service.interface';
import { DBService } from './db-service';
import { InviteProfilesResult } from './invite-profiles.interface';

/**
 * Service for reading/writing project data.
 *
 * @export
 * @class ProjectService
 * @extends {DBService}
 */
export class ProjectService extends DBService {
  projectRepository: ProjectRepository;
  projectProfileService: ProjectProfileService;
  projectPermissionService: ProjectPermissionService;
  profileRepository: ProfileRepository;

  /**
   * Creates an instance of ProjectService.
   *
   * @param {IDBConnection} connection Database connection used for queries and transaction context.
   * @memberof ProjectService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.projectRepository = new ProjectRepository(connection);
    this.projectProfileService = new ProjectProfileService(connection);
    this.projectPermissionService = new ProjectPermissionService(connection);
    this.profileRepository = new ProfileRepository(connection);
  }

  /**
   * Create a new project.
   *
   * @param {CreateProject} project Project fields to persist.
   * @returns {Promise<Project>} The project record.
   * @memberof ProjectService
   */
  async createProject(project: CreateProject): Promise<Project> {
    const colour = project.colour ?? generateHexColourFromSeed(project.name);
    return this.projectRepository.createProject({ ...project, colour });
  }

  /**
   * Create a new project and optionally assign the creator as an admin.
   *
   * @param {CreateProject} project Project fields to persist.
   * @param {string | null} profileId Identifier of the profile whose access or records are used.
   * @returns {Promise<Project>} The project record.
   * @memberof ProjectService
   */
  async createProjectWithCreator(project: CreateProject, profileId?: string | null): Promise<Project> {
    const colour = project.colour ?? generateHexColourFromSeed(project.name);
    const createdProject = await this.projectRepository.createProject({ ...project, colour });

    if (!profileId) {
      return createdProject;
    }

    await this.projectProfileService.createProjectProfile({
      project_id: createdProject.project_id,
      profile_id: profileId
    });

    const adminRoleId = await this.profileRepository.getRoleIdByNameAndScope(PROJECT_ROLE.PROJECT_ADMIN, 'project');

    await this.projectPermissionService.createProjectPermission({
      project_id: createdProject.project_id,
      profile_id: profileId,
      role_id: adminRoleId
    });

    return createdProject;
  }

  /**
   * Adds existing profiles to a project by email address.
   *
   * @param {string} projectId Identifier of the project.
   * @param {string[]} emails Email addresses of the profiles to invite.
   * @returns {Promise<InviteProfilesResult>} Invitation results identifying added, existing, and unresolved profiles.
   * @memberof ProjectService
   */
  async inviteProfilesToProject(projectId: string, emails: string[]): Promise<InviteProfilesResult> {
    const normalizedEmails = normalizeInviteEmails(emails);

    if (!normalizedEmails.length) {
      return { added_profile_ids: [], skipped_emails: [] };
    }

    const profiles = await Promise.all(
      normalizedEmails.map((email) => this.profileRepository.findProfileByEmail(email))
    );

    const profilesByEmail = new Map<string, string>();
    const skippedEmails: string[] = [];

    normalizedEmails.forEach((email, index) => {
      const profile = profiles[index];
      if (profile?.profile_id) {
        profilesByEmail.set(email, profile.profile_id);
      } else {
        skippedEmails.push(email);
      }
    });

    if (!profilesByEmail.size) {
      return { added_profile_ids: [], skipped_emails: skippedEmails };
    }

    const existingProfiles = await this.projectProfileService.getProjectProfilesByProjectId(projectId);
    const existingProfileIds = new Set(existingProfiles.map((profile) => profile.profile_id));
    const memberRoleId = await this.profileRepository.getRoleIdByNameAndScope(PROJECT_ROLE.PROJECT_USER, 'project');

    const addedProfileIds: string[] = [];

    for (const profileId of profilesByEmail.values()) {
      if (existingProfileIds.has(profileId)) {
        continue;
      }

      await this.projectProfileService.createProjectProfile({
        project_id: projectId,
        profile_id: profileId
      });

      await this.projectPermissionService.createProjectPermission({
        project_id: projectId,
        profile_id: profileId,
        role_id: memberRoleId
      });

      addedProfileIds.push(profileId);
    }

    return { added_profile_ids: addedProfileIds, skipped_emails: skippedEmails };
  }

  /**
   * Get a project by project ID.
   *
   * @param {string} projectId Identifier of the project.
   * @returns {Promise<Project>} The project record.
   * @memberof ProjectService
   */
  async getProjectById(projectId: string): Promise<Project> {
    return this.projectRepository.getProjectById(projectId);
  }

  /**
   * Get all active projects.
   *
   * @returns {Promise<Project[]>} Matching project records.
   * @memberof ProjectService
   */
  async getProjects(): Promise<Project[]> {
    return this.projectRepository.getProjects();
  }

  /**
   * Get all active projects available to a specific profile GUID.
   *
   * @param {string} profileGuid External identity provider GUID for the profile.
   * @returns {Promise<Project[]>} Matching project records.
   * @memberof ProjectService
   */
  async getProjectsForProfileGuid(profileGuid: string): Promise<Project[]> {
    return this.projectRepository.getProjectsByProfileGuid(profileGuid);
  }

  /**
   * Update an existing project.
   *
   * @param {string} projectId Identifier of the project.
   * @param {UpdateProject} updates Fields to update on the existing record.
   * @returns {Promise<Project>} The project record.
   * @memberof ProjectService
   */
  async updateProject(projectId: string, updates: UpdateProject): Promise<Project> {
    return this.projectRepository.updateProject(projectId, updates);
  }

  /**
   * Soft delete a project.
   *
   * @param {DeleteProject} data Data to persist or process.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof ProjectService
   */
  async deleteProject(data: DeleteProject): Promise<void> {
    return this.projectRepository.deleteProject(data);
  }
}

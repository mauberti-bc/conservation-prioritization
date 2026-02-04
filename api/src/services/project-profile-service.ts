import { IDBConnection } from '../database/db';
import {
  CreateProjectProfile,
  DeleteProjectProfile,
  ProjectProfile,
  ProjectProfileExtended,
  UpdateProjectProfile
} from '../models/project-profile';
import { ProjectProfileRepository } from '../repositories/project-profile-repository';
import { DBService } from './db-service';

/**
 * Service for reading/writing project profile associations.
 *
 * @export
 * @class ProjectProfileService
 * @extends {DBService}
 */
export class ProjectProfileService extends DBService {
  projectProfileRepository: ProjectProfileRepository;

  /**
   * Creates an instance of ProjectProfileService.
   *
   * @param {IDBConnection} connection
   * @memberof ProjectProfileService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.projectProfileRepository = new ProjectProfileRepository(connection);
  }

  /**
   * Creates a new project profile association.
   *
   * @param {CreateProjectProfile} projectProfile - The data for creating a new project profile association.
   * @return {Promise<ProjectProfile>} The newly created project profile.
   * @memberof ProjectProfileService
   */
  async createProjectProfile(projectProfile: CreateProjectProfile): Promise<ProjectProfile> {
    return this.projectProfileRepository.createProjectProfile(projectProfile);
  }

  /**
   * Fetches a project profile by its ID.
   *
   * @param {string} projectProfileId - The UUID of the project profile to fetch.
   * @return {Promise<ProjectProfile>} The matching project profile.
   * @memberof ProjectProfileService
   */
  async getProjectProfileById(projectProfileId: string): Promise<ProjectProfile> {
    return this.projectProfileRepository.getProjectProfileById(projectProfileId);
  }

  /**
   * Fetches all project profiles for a given project ID.
   *
   * @param {string} projectId - The UUID of the project.
   * @return {Promise<ProjectProfileExtended[]>} A list of project profiles associated with the given project.
   * @memberof ProjectProfileService
   */
  async getProjectProfilesByProjectId(projectId: string): Promise<ProjectProfileExtended[]> {
    return this.projectProfileRepository.getProjectProfilesByProjectId(projectId);
  }

  /**
   * Updates an existing project profile association.
   *
   * @param {string} projectProfileId - The UUID of the project profile to update.
   * @param {UpdateProjectProfile} updates - The data to update in the project profile association.
   * @return {Promise<ProjectProfile>} The updated project profile.
   * @memberof ProjectProfileService
   */
  async updateProjectProfile(projectProfileId: string, updates: UpdateProjectProfile): Promise<ProjectProfile> {
    return this.projectProfileRepository.updateProjectProfile(projectProfileId, updates);
  }

  /**
   * Soft deletes a project profile association by setting its record end date.
   *
   * @param {DeleteProjectProfile} data - The data containing the project_profile_id to delete.
   * @return {Promise<void>} Resolves when the project profile is successfully deleted.
   * @memberof ProjectProfileService
   */
  async deleteProjectProfile(data: DeleteProjectProfile): Promise<void> {
    return this.projectProfileRepository.deleteProjectProfile(data);
  }

  /**
   * Get the role name for a specific profile on a project.
   *
   * @param {string} projectId - The ID of the project.
   * @param {string} profileId - The ID of the profile.
   * @return {Promise<string | null>} - Returns the role name if found, otherwise null.
   * @memberof ProjectProfileRepository
   */
  async getRoleForProjectProfile(projectId: string, profileId: string): Promise<string | null> {
    return this.projectProfileRepository.getRoleForProjectProfile(projectId, profileId);
  }
}

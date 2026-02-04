import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { CreateProfile, DeleteProfile, Profile, UpdateProfile, UpsertProfile } from '../models/profile';
import { ProfileRepository } from '../repositories/profile-repository';
import { DBService } from './db-service';

/**
 * Service for reading/writing profile data.
 *
 * @export
 * @class ProfileService
 * @extends {DBService}
 */
export class ProfileService extends DBService {
  profileRepository: ProfileRepository;

  /**
   * Creates an instance of ProfileService.
   *
   * @param {IDBConnection} connection
   * @memberof ProfileService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.profileRepository = new ProfileRepository(connection);
  }

  /**
   * Create a new profile.
   *
   * @param {CreateProfile} profile
   * @return {Promise<Profile>}
   * @memberof ProfileService
   */
  async createProfile(profile: CreateProfile): Promise<Profile> {
    return this.profileRepository.createProfile(profile);
  }

  /**
   * Get a profile by profile ID.
   *
   * @param {string} profileId
   * @return {Promise<Profile>}
   * @memberof ProfileService
   */
  async getProfileById(profileId: string): Promise<Profile> {
    return this.profileRepository.getProfileById(profileId);
  }

  /**
   * Get a profile by profile GUID.
   *
   * @param {string} profileGuid
   * @return {Promise<Profile>}
   * @memberof ProfileService
   */
  async findProfileByGuid(profileGuid: string): Promise<Profile | null> {
    return this.profileRepository.findProfileByGuid(profileGuid);
  }

  /**
   * Get a profile by identity source + identifier.
   *
   * @param {string} identitySource
   * @param {string} profileIdentifier
   * @return {Promise<Profile | null>}
   * @memberof ProfileService
   */
  async getProfileByIdentifier(identitySource: string, profileIdentifier: string): Promise<Profile | null> {
    return this.profileRepository.findProfileByIdentifier(identitySource, profileIdentifier);
  }

  /**
   * Update an existing profile.
   *
   * @param {string} profileId
   * @param {UpdateProfile} updates
   * @return {Promise<Profile>}
   * @memberof ProfileService
   */
  async updateProfile(profileId: string, updates: UpdateProfile): Promise<Profile> {
    return this.profileRepository.updateProfile(profileId, updates);
  }

  /**
   * Soft delete a profile.
   *
   * @param {DeleteProfile} data
   * @return {Promise<void>}
   * @memberof ProfileService
   */
  async deleteProfile(data: DeleteProfile): Promise<void> {
    return this.profileRepository.deleteProfile(data);
  }

  /**
   * Upsert a profile (create if not found, update if exists).
   *
   * @param {UpsertProfile} profile
   * @return {[Promise<Profile>, boolean]}
   * @memberof ProfileService
   */
  async upsertProfile(profile: UpsertProfile): Promise<[Profile, boolean]> {
    const existingProfile = await this.profileRepository.findProfileByGuid(profile.profile_guid);

    if (existingProfile) {
      return [await this.profileRepository.updateProfile(existingProfile.profile_id, profile as UpdateProfile), false];
    }

    const roleId = await this.profileRepository.getRoleIdByName(SYSTEM_ROLE.MEMBER);

    return [
      await this.profileRepository.createProfile({
        ...profile,
        role_id: roleId
      } as CreateProfile),
      true
    ];
  }
}

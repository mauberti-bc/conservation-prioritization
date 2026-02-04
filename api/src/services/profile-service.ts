import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { CreateProfile, DeleteProfile, Profile, UpdateProfile, UpsertProfile } from '../models/profile';
import { ProfileRepository } from '../repositories/profile-repository';
import { ApiExecuteSQLError } from '../errors/api-error';
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
   * Upsert a profile using the profile GUID as the primary identifier.
   *
   * If the profile exists, it is updated to match the supplied values.
   * If it does not exist, it is created with the MEMBER role.
   *
   * @param {UpsertProfile} profile
   * @return {[Promise<Profile>, boolean]}
   * @memberof ProfileService
   */
  async upsertProfile(profile: UpsertProfile): Promise<[Profile, boolean]> {
    const existingProfile = await this.profileRepository.findProfileByGuid(profile.profile_guid);

    if (existingProfile) {
      const hasChanges =
        existingProfile.identity_source !== profile.identity_source ||
        existingProfile.profile_identifier !== profile.profile_identifier ||
        existingProfile.profile_guid !== profile.profile_guid ||
        (existingProfile.display_name ?? null) !== (profile.display_name ?? null) ||
        (existingProfile.email ?? null) !== (profile.email ?? null) ||
        (existingProfile.given_name ?? null) !== (profile.given_name ?? null) ||
        (existingProfile.family_name ?? null) !== (profile.family_name ?? null) ||
        (existingProfile.agency ?? null) !== (profile.agency ?? null) ||
        (existingProfile.notes ?? null) !== (profile.notes ?? null);

      if (!hasChanges) {
        return [existingProfile, false];
      }

      const updates: UpdateProfile = {
        identity_source: profile.identity_source,
        profile_identifier: profile.profile_identifier,
        profile_guid: profile.profile_guid,
        display_name: profile.display_name,
        email: profile.email,
        given_name: profile.given_name,
        family_name: profile.family_name,
        agency: profile.agency,
        notes: profile.notes
      };

      try {
        return [await this.profileRepository.updateProfile(existingProfile.profile_id, updates), false];
      } catch (error) {
        if (error instanceof ApiExecuteSQLError) {
          const latestProfile = await this.profileRepository.findProfileByGuid(profile.profile_guid);
          if (latestProfile) {
            return [latestProfile, false];
          }
        }
        throw error;
      }
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

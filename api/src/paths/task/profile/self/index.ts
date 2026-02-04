import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { UpsertProfile } from '../../../../models/profile';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetProfileSchema } from '../../../../openapi/schemas/profile';
import { ProfileService } from '../../../../services/profile-service';
import {
  getAgency,
  getDisplayName,
  getEmail,
  getFamilyName,
  getGivenName,
  getUserGuid,
  getUserIdentifier,
  getUserIdentitySource
} from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger(__filename);

export const PUT: Operation = [upsertProfile()];

PUT.apiDoc = {
  description:
    'Upsert the currently authenticated user profile. Registers a new profile or updates an existing profile. Returns 401 if the user is expired.',
  tags: ['profile'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'Profile updated successfully.',
      content: {
        'application/json': {
          schema: GetProfileSchema
        }
      }
    },
    201: {
      description: 'Profile successfully registered.',
      content: {
        'application/json': {
          schema: GetProfileSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Upsert the currently authenticated user profile.
 *
 * - If profile doesn't exist: registers a new profile (returns 201)
 * - If profile exists and is active: updates profile fields (returns 200)
 * - If profile exists but is expired: throws 401
 *
 * @returns {RequestHandler}
 */
export function upsertProfile(): RequestHandler {
  return async (req, res) => {
    // Use API user connection since the user may not have a profile yet
    const connection = getAPIUserDBConnection();

    try {
      // Extract user details from JWT token
      const userGuid = getUserGuid(req.keycloak_token);
      const userIdentifier = getUserIdentifier(req.keycloak_token);
      const identitySource = getUserIdentitySource(req.keycloak_token);

      if (!userGuid) {
        throw new HTTP400('Failed to identify user GUID from token');
      }

      if (!userIdentifier) {
        throw new HTTP400('Failed to identify user identifier from token');
      }

      // Extract profile fields from token
      const payload: UpsertProfile = {
        profile_guid: userGuid,
        profile_identifier: userIdentifier,
        identity_source: identitySource,
        display_name: getDisplayName(req.keycloak_token),
        email: getEmail(req.keycloak_token),
        given_name: getGivenName(req.keycloak_token),
        family_name: getFamilyName(req.keycloak_token),
        agency: getAgency(req.keycloak_token),
        notes: null
      };

      await connection.open();

      const profileService = new ProfileService(connection);

      // Upsert profile - registers if not found, updates if active
      const [profile, created] = await profileService.upsertProfile(payload);

      await connection.commit();

      // Send response with appropriate status (201 for created, 200 for updated)
      return res.status(created ? 201 : 200).json(profile);
    } catch (error) {
      defaultLog.error({ label: 'upsertProfile', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

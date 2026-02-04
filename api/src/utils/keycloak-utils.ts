import { IDENTITY_SOURCE } from '../constants/database';
import { getDBConstants } from '../database/db-constants';
import { Profile } from '../models/profile';

/**
 * Extracts the user's GUID from the Keycloak token.
 * Now assumes the token contains `sub` which maps to `profile_guid`.
 *
 * @param keycloakToken
 * @returns profile_guid or null
 */
export const getUserGuid = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.sub ?? null;
};

/**
 * Determines the user's identity source.
 * Assumes the token has `identity_provider` field, otherwise defaults to DATABASE.
 *
 * @param keycloakToken
 */
export const getUserIdentitySource = (keycloakToken: Record<string, any>): IDENTITY_SOURCE => {
  const raw = keycloakToken?.identity_provider;
  return coerceUserIdentitySource(raw);
};

/**
 * Coerces a raw identity provider string into IDENTITY_SOURCE enum.
 * Defaults to DATABASE if unrecognized.
 */
export const coerceUserIdentitySource = (raw?: string | null): IDENTITY_SOURCE => {
  if (!raw) return IDENTITY_SOURCE.DATABASE;

  switch (raw.toUpperCase()) {
    case IDENTITY_SOURCE.IDIR:
      return IDENTITY_SOURCE.IDIR;
    case IDENTITY_SOURCE.SYSTEM:
      return IDENTITY_SOURCE.SYSTEM;
    case IDENTITY_SOURCE.DATABASE:
      return IDENTITY_SOURCE.DATABASE;
    default:
      return IDENTITY_SOURCE.DATABASE;
  }
};

/**
 * Extracts the user's identifier.
 * Previously used `idir_username` or `bceid_username`.
 * Now fallback to `profile_identifier` in Keycloak token if available.
 */
export const getUserIdentifier = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.profile_identifier ?? null;
};

/**
 * Maps the Keycloak token `sub` field to a known service client user.
 * Uses `profile_guid` to find the user in DB constants.
 */
export const getServiceClientProfile = (keycloakToken: Record<string, any>): Profile | null => {
  const guid = keycloakToken?.sub;
  if (!guid) return null;

  return getDBConstants().serviceClientUsers.find((p) => p.profile_guid === guid) ?? null;
};

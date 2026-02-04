import { IDENTITY_SOURCE } from '../constants/database';
import { getDBConstants } from '../database/db-constants';
import { Profile } from '../models/profile';

/**
 * Parses out the user's GUID from a Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The user GUID or null if not found.
 */
export const getUserGuid = (keycloakToken: Record<string, any>): string | null => {
  const userGuid = keycloakToken?.['preferred_username']?.split('@')?.[0] ?? null;
  return userGuid;
};

/**
 * Parses out the identity source from the Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {IDENTITY_SOURCE} The identity source value from the token.
 */
export const getUserIdentitySource = (keycloakToken: Record<string, any>): IDENTITY_SOURCE => {
  const identitySource: string =
    keycloakToken?.['identity_provider'] || keycloakToken?.['preferred_username']?.split('@')?.[1];

  return coerceUserIdentitySource(identitySource);
};

/**
 * Coerces the raw Keycloak identity provider value into a system identity source enum value.
 * Defaults to `DATABASE` if the value is not recognized.
 *
 * @param {string | null} identitySource - The raw identity provider string.
 * @return {IDENTITY_SOURCE} The coerced system identity source.
 */
export const coerceUserIdentitySource = (identitySource: string | null): IDENTITY_SOURCE => {
  const source = identitySource?.toUpperCase() ?? 'DATABASE';
  switch (source) {
    case 'IDIR':
      return IDENTITY_SOURCE.IDIR;
    case 'SYSTEM':
      return IDENTITY_SOURCE.SYSTEM;
    default:
      return IDENTITY_SOURCE.DATABASE;
  }
};

/**
 * Parses the user's identifier from the Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The user's identifier or null if not found.
 */
export const getUserIdentifier = (keycloakToken: Record<string, any>): string | null => {
  const userIdentifier = (keycloakToken?.['idir_username'] || keycloakToken?.['bceid_username']) ?? null;
  return userIdentifier;
};

/**
 * Parses out the `sub` field from the Keycloak token and returns a known service client if found.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {Profile | null} A matching service client system user or null if not found.
 */
export const getServiceClientProfile = (keycloakToken: Record<string, any>): Profile | null => {
  const sub = keycloakToken?.['sub'];
  if (!sub) {
    return null;
  }

  return getDBConstants().serviceClientUsers.find((item) => item.user_guid === sub) ?? null;
};

/**
 * Parses the user's display name from a Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The display name or null if not found.
 */
export const getDisplayName = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.['display_name'] ?? null;
};

/**
 * Parses the user's email from a Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The email address or null if not found.
 */
export const getEmail = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.['email'] ?? null;
};

/**
 * Parses the user's given name (first name) from a Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The given name or null if not found.
 */
export const getGivenName = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.['given_name'] ?? null;
};

/**
 * Parses the user's family name (last name) from a Keycloak token.
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The family name or null if not found.
 */
export const getFamilyName = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.['family_name'] ?? null;
};

/**
 * Parses the user's agency from a Keycloak token (for BCeID Business users).
 *
 * @param {Record<string, any>} keycloakToken
 * @return {string | null} The agency name or null if not found.
 */
export const getAgency = (keycloakToken: Record<string, any>): string | null => {
  return keycloakToken?.['bceid_business_name'] ?? null;
};

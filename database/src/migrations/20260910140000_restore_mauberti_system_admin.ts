import { Knex } from 'knex';
import { IDENTITY_SOURCE, SYSTEM_ROLE } from '../constants/profile';

const DB_USER_API = process.env.DB_USER_API!;

/**
 * Restores the MAUBERTI Azure IDIR profile as a system administrator.
 *
 * Defines the audit context function so this migration does not depend on procedure seeds.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the administrator profile is upserted.
 * @throws {Error} Rejects if the API profile cannot be resolved or PostgreSQL rejects the upsert.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE OR REPLACE FUNCTION api_set_context(
      p_profile_guid varchar(200),
      p_identity_source identity_source
    ) RETURNS uuid
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET client_min_messages = warning
    AS
    $$
    DECLARE
      _profile_id uuid;
    BEGIN
      SELECT profile_id INTO STRICT _profile_id
      FROM profile
      WHERE identity_source = p_identity_source
        AND profile_guid = p_profile_guid
        AND record_end_date IS NULL;

      PERFORM set_config('app.profile_id', _profile_id::text, true);
      RETURN _profile_id;
    END;
    $$;

    SELECT api_set_context('${DB_USER_API}', '${IDENTITY_SOURCE.DATABASE}');

    INSERT INTO profile (
      profile_guid,
      profile_identifier,
      identity_source,
      role_id,
      display_name,
      email,
      given_name,
      family_name,
      agency,
      notes,
      record_end_date
    )
    SELECT
      LOWER('62ec624e50844486a046dc9709854f8d@azureidir'),
      LOWER('MAUBERTI'),
      '${IDENTITY_SOURCE.AZURE_IDIR}',
      role.role_id,
      'mauberti',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    FROM role
    WHERE role.name = '${SYSTEM_ROLE.ADMIN}'
      AND role.scope = 'system'
      AND role.record_end_date IS NULL
    ON CONFLICT (profile_guid)
    DO UPDATE SET
      profile_identifier = LOWER('MAUBERTI'),
      identity_source = '${IDENTITY_SOURCE.AZURE_IDIR}',
      role_id = EXCLUDED.role_id,
      display_name = 'mauberti',
      email = NULL,
      given_name = NULL,
      family_name = NULL,
      agency = NULL,
      notes = NULL,
      record_end_date = NULL;
  `);
}

/**
 * Restores the MAUBERTI profile to the standard member system role.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the profile role is reverted.
 * @throws {Error} Rejects if PostgreSQL rejects the rollback statement.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    SELECT api_set_context('${DB_USER_API}', '${IDENTITY_SOURCE.DATABASE}');

    UPDATE profile
    SET role_id = role.role_id
    FROM role
    WHERE LOWER(profile.profile_guid) = LOWER('62ec624e50844486a046dc9709854f8d@azureidir')
      AND profile.record_end_date IS NULL
      AND role.name = '${SYSTEM_ROLE.MEMBER}'
      AND role.scope = 'system'
      AND role.record_end_date IS NULL;
  `);
}

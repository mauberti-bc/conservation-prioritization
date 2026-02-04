import { Knex } from 'knex';

/**
 * Creates the `api_set_context` procedure, which is a trigger for updating the `created_*` and `updated_*` fields
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    
    -- Drop the function if it already exists
    DROP FUNCTION IF EXISTS api_set_context;
    DROP FUNCTION IF EXISTS api_get_context_profile_id;

    -- Create the function
    CREATE OR REPLACE FUNCTION api_set_context(
      p_profile_guid varchar(200),  -- Profile GUID (string)
      p_identity_source identity_source  -- Profile Identity Source (ENUM)
    ) RETURNS uuid  -- Returns profile_id (uuid)
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET client_min_messages = warning
    AS
    $$
    DECLARE
      _profile_id uuid;  -- Declare a variable for profile_id
    BEGIN
      -- Select the system profile ID based on the profile GUID and identity source ENUM
      SELECT profile_id 
      INTO STRICT _profile_id
      FROM "profile"
      WHERE identity_source = p_identity_source  -- Match by identity source enum
        AND profile_guid = p_profile_guid
        AND record_end_date IS NULL;  -- Ensure we're only working with active records

      -- Create temporary table to store the context data (if it doesn't exist)
      CREATE TEMP TABLE IF NOT EXISTS conservation_context_temp (
        tag VARCHAR(200),
        value VARCHAR(200)
      );

      -- Delete any existing context for 'profile_id' tag
      DELETE FROM conservation_context_temp WHERE tag = 'profile_id';

      -- Insert the new profile ID into the context table
      INSERT INTO conservation_context_temp (tag, value)
      VALUES ('profile_id', _profile_id::varchar(200));  -- Cast UUID to string for context

      -- Return the system profile ID
      RETURN _profile_id;

    EXCEPTION
      WHEN OTHERS THEN
        -- Reraise any errors for better debugging
        RAISE;
    END;
    $$;

    -- Create a helper function to read the current profile_id context
    CREATE OR REPLACE FUNCTION api_get_context_profile_id() RETURNS uuid
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET client_min_messages = warning
    AS
    $$
    DECLARE
      _profile_id uuid;
    BEGIN
      SELECT value::uuid INTO _profile_id
      FROM conservation_context_temp
      WHERE tag = 'profile_id';

      IF (_profile_id IS NULL) THEN
        RAISE EXCEPTION 'No profile_id found in conservation_context_temp';
      END IF;

      RETURN _profile_id;
    END;
    $$;
  `);
}

import { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI Schema for the Profile.
 */
export const GetProfileSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['profile_id', 'identity_source', 'profile_identifier', 'profile_guid'],
  properties: {
    profile_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the profile in the system.'
    },
    identity_source: {
      type: 'string',
      description: 'The source of the profile’s identity (e.g., IDIR, BCeID, DATABASE).'
    },
    profile_identifier: {
      type: 'string',
      maxLength: 200,
      description: 'The identifier for the profile (e.g., username or email).'
    },
    profile_guid: {
      type: 'string',
      maxLength: 200,
      description: 'Unique identifier for the profile (GUID).'
    },
    role_id: {
      type: 'integer',
      nullable: true,
      description: 'The ID of the user’s role, if assigned.'
    },
    role_name: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'The name of the user’s role, if assigned.'
    }
  }
};

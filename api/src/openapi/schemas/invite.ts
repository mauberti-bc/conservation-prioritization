import { OpenAPIV3 } from 'openapi-types';

/**
 * Schema for inviting profiles by email.
 */
export const InviteProfilesSchema: OpenAPIV3.SchemaObject = {
  title: 'InviteProfiles',
  type: 'object',
  required: ['emails'],
  additionalProperties: false,
  properties: {
    emails: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        format: 'email'
      }
    }
  }
};

/**
 * Schema for invite results.
 */
export const InviteProfilesResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'InviteProfilesResponse',
  type: 'object',
  required: ['added_profile_ids', 'skipped_emails'],
  additionalProperties: false,
  properties: {
    added_profile_ids: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uuid'
      }
    },
    skipped_emails: {
      type: 'array',
      items: {
        type: 'string',
        format: 'email'
      }
    }
  }
};

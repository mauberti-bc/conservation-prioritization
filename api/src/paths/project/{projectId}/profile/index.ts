import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { InviteProfilesResponseSchema, InviteProfilesSchema } from '../../../../openapi/schemas/invite';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ProjectService } from '../../../../services/project-service';
import { getLogger } from '../../../../utils/logger';
import { InviteProfilesBody } from './invite-profiles.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Project',
          projectId: req.params.projectId
        }
      ]
    };
  }),
  inviteProfilesToProject()
];

POST.apiDoc = {
  description: 'Invites existing profiles to a project by email address.',
  tags: ['projects', 'profiles'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: InviteProfilesSchema
      }
    }
  },
  parameters: [
    {
      in: 'path',
      name: 'projectId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the project to invite profiles to.'
    }
  ],
  responses: {
    201: {
      description: 'Profiles invited to project.',
      content: {
        'application/json': {
          schema: InviteProfilesResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to invite profiles to a project.
 *
 * @returns {RequestHandler}
 */
export function inviteProfilesToProject(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'inviteProfilesToProject' });

    const projectId = req.params.projectId as string;
    const body = req.body as InviteProfilesBody;
    const emails = Array.isArray(body?.emails) ? body.emails : [];

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const projectService = new ProjectService(connection);
      const result = await projectService.inviteProfilesToProject(projectId, emails);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'inviteProfilesToProject', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

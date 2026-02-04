import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { InviteProfilesResponseSchema, InviteProfilesSchema } from '../../../../openapi/schemas/invite';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskService } from '../../../../services/task-service';
import { getLogger } from '../../../../utils/logger';
import { InviteProfilesBody } from './invite-profiles.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  inviteProfilesToTask()
];

POST.apiDoc = {
  description: 'Invites existing profiles to a task by email address.',
  tags: ['tasks', 'profiles'],
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
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to invite profiles to.'
    }
  ],
  responses: {
    201: {
      description: 'Profiles invited to task.',
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
 * Express request handler to invite profiles to a task.
 *
 * @returns {RequestHandler}
 */
export function inviteProfilesToTask(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'inviteProfilesToTask' });

    const taskId = req.params.taskId as string;
    const body = req.body as InviteProfilesBody;
    const emails = Array.isArray(body?.emails) ? body.emails : [];

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);
      const result = await taskService.inviteProfilesToTask(taskId, emails);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'inviteProfilesToTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

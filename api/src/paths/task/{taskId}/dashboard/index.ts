import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { DashboardSchema } from '../../../../openapi/schemas/dashboard';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DashboardService } from '../../../../services/dashboard-service';
import { HTTP400 } from '../../../../errors/http-error';
import { getLogger } from '../../../../utils/logger';
import { PublishDashboardBody } from './publish-dashboard.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'Profile'
        }
      ]
    };
  }),
  publishDashboard()
];

POST.apiDoc = {
  description: 'Publish a task to a new dashboard.',
  tags: ['tasks', 'dashboards'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to publish.'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name', 'access_scheme'],
          properties: {
            name: {
              type: 'string'
            },
            access_scheme: {
              type: 'string',
              enum: ['ANYONE_WITH_LINK', 'MEMBERS_ONLY', 'NOBODY']
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Dashboard created successfully.',
      content: {
        'application/json': {
          schema: DashboardSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to publish a task to a dashboard.
 *
 * @returns {RequestHandler}
 */
export function publishDashboard(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'publishDashboard' });

    const body = req.body as PublishDashboardBody;

    const taskId = req.params.taskId as string;
    const name = body?.name?.trim();

    if (!name) {
      throw new HTTP400('Dashboard name is required.');
    }

    const accessScheme = body?.access_scheme ?? 'MEMBERS_ONLY';

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const profileId = connection.profileId();

      const dashboardService = new DashboardService(connection);
      const response = await dashboardService.publishTaskToDashboard(taskId, profileId, name, accessScheme);

      await connection.commit();

      const dashboardUrl = `/t/dashboard/${response.dashboard.dashboard_id}`;

      return res.status(201).json({
        ...response.dashboard,
        task_ids: response.task_ids,
        dashboard_url: dashboardUrl
      });
    } catch (error) {
      defaultLog.error({ label: 'publishDashboard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

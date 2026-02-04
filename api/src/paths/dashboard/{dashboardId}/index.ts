import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { DashboardSchema } from '../../../openapi/schemas/dashboard';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DashboardService } from '../../../services/dashboard-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger(__filename);

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'Profile'
        }
      ]
    };
  }),
  getDashboard()
];

GET.apiDoc = {
  description: 'Fetch a dashboard by ID.',
  tags: ['dashboards'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dashboardId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the dashboard.'
    }
  ],
  responses: {
    200: {
      description: 'Dashboard returned successfully.',
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
 * Express request handler to fetch a dashboard by ID.
 *
 * @returns {RequestHandler}
 */
export function getDashboard(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getDashboard' });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const profileId = connection.profileId();

      const dashboardId = req.params.dashboardId;

      const dashboardService = new DashboardService(connection);
      const response = await dashboardService.getDashboardWithTasks(dashboardId, profileId);

      await connection.commit();

      const dashboardUrl = `/t/dashboard/${response.dashboard.dashboard_id}`;

      return res.status(200).json({
        ...response.dashboard,
        task_ids: response.task_ids,
        dashboard_url: dashboardUrl
      });
    } catch (error) {
      defaultLog.error({ label: 'getDashboard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

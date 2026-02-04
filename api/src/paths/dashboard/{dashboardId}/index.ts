import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { DashboardSchema } from '../../../openapi/schemas/dashboard';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { DashboardService } from '../../../services/dashboard-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger(__filename);

export const GET: Operation = [getDashboard()];

GET.apiDoc = {
  description: 'Fetch a dashboard by ID.',
  tags: ['dashboards'],
  security: [
    {
      OptionalBearer: []
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

    const hasToken = Boolean(req.keycloak_token);
    const connection = hasToken ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const profileId = hasToken ? connection.profileId() : null;

      const dashboardId = req.params.dashboardId as string;

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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { DashboardRepository } from '../../../../repositories/dashboard-repository';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger(__filename);

export const GET: Operation = [getDashboardAccess()];

GET.apiDoc = {
  description: 'Check whether a dashboard is publicly accessible without revealing metadata.',
  tags: ['dashboards'],
  security: [{ OptionaBearer: [] }],
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
      description: 'Dashboard is publicly accessible.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['access'],
            properties: {
              access: {
                type: 'string',
                enum: ['PUBLIC']
              }
            }
          }
        }
      }
    },
    401: {
      description: 'Dashboard is not publicly accessible or requires authentication.'
    }
  }
};

/**
 * Express request handler to check public dashboard access.
 *
 * @returns {RequestHandler}
 */
export function getDashboardAccess(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getDashboardAccess' });

    const dashboardId = req.params.dashboardId;
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const profileId = req.keycloak_token ? connection.profileId() : null;

      const dashboardRepository = new DashboardRepository(connection);
      const accessScheme = await dashboardRepository.findDashboardAccessScheme(dashboardId);

      await connection.commit();

      if (accessScheme === 'ANYONE_WITH_LINK') {
        return res.status(200).json({ access: 'PUBLIC' });
      }

      return res.status(401).end();
    } catch (error) {
      defaultLog.error({ label: 'getDashboardAccess', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

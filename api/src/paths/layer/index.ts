import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationResponseSchema } from '../../openapi/schemas/pagination';
import { GetTaskSchema } from '../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { LayerService } from '../../services/layer-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger(__filename);

/**
 * GET /layers
 *
 * Returns all layers in the system.
 */
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
  findLayers()
];

GET.apiDoc = {
  description: 'Fetches all layers in the system.',
  tags: ['layers'],
  parameters: [
    {
      description: 'Search term',
      in: 'query',
      name: 'keyword',
      required: true,
      schema: {
        type: 'string'
      }
    }
  ],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of layers returned successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['layers', 'pagination'],
            properties: {
              layers: {
                type: 'array',
                items: GetTaskSchema
              },
              pagination: { ...paginationResponseSchema, nullable: true }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch all layers.
 *
 * @returns {RequestHandler}
 */
export function findLayers(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'findLayers' });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const layerService = new LayerService();

      const keyword = req.params.keyword as string;

      const { layers, pagination } = await layerService.findLayers(keyword);

      await connection.commit();

      return res.status(200).json({ layers, pagination });
    } catch (error) {
      defaultLog.error({ label: 'findLayers', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

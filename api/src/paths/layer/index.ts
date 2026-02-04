import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { LayerMetaSchema } from '../../openapi/schemas/layer';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { LayerService } from '../../services/layer-service';
import { getLogger } from '../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../utils/pagination';

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
      required: false,
      schema: {
        type: 'string'
      }
    },
    ...paginationRequestQueryParamSchema
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
                items: LayerMetaSchema
              },
              pagination: paginationResponseSchema
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
    try {
      const layerService = new LayerService();

      const keyword = (req.query.keyword ?? '') as string;

      const pagination = ensureCompletePaginationOptions(makePaginationOptionsFromRequest(req));

      const { layers, pagination: paginationResult } = await layerService.findLayers(keyword, pagination);
      const responsePagination = paginationResult ?? makePaginationResponse(layers.length, pagination);

      return res.status(200).json({ layers, pagination: responsePagination });
    } catch (error) {
      defaultLog.error({ label: 'findLayers', message: 'error', error });
      throw error;
    }
  };
}

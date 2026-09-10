import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { CreateMarkdown } from '../../../models/markdown';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  AdminMarkdownListItemSchema,
  AdminMarkdownSchema,
  MarkdownWriteSchema
} from '../../../openapi/schemas/markdown';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { AdminMarkdownService } from '../../../services/admin-markdown-service';
import { getLogger } from '../../../utils/logger';
import { ensureCompletePaginationOptions, makePaginationOptionsFromRequest } from '../../../utils/pagination';

const defaultLog = getLogger(__filename);

const adminAuthorization = () => {
  return {
    and: [
      {
        discriminator: 'Profile' as const,
        validSystemRoles: [SYSTEM_ROLE.ADMIN]
      }
    ]
  };
};

export const GET: Operation = [authorizeRequestHandler(adminAuthorization), getMarkdowns()];

GET.apiDoc = {
  description: 'Fetches Markdown documents for administration.',
  tags: ['admin', 'markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      description: 'Case-insensitive Markdown key/data search term.',
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Markdown documents returned successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['markdown', 'pagination'],
            properties: {
              markdown: {
                type: 'array',
                items: AdminMarkdownListItemSchema
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

export const POST: Operation = [authorizeRequestHandler(adminAuthorization), createMarkdown()];

POST.apiDoc = {
  description: 'Creates a Markdown document.',
  tags: ['admin', 'markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: MarkdownWriteSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Markdown document created successfully.',
      content: {
        'application/json': {
          schema: AdminMarkdownSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch paginated Markdown records.
 *
 * @returns {RequestHandler}
 */
export function getMarkdowns(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getMarkdowns' });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const paginationRequest = makePaginationOptionsFromRequest(req);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const pagination = ensureCompletePaginationOptions(paginationRequest) ?? { page: 1, limit: 25 };

      const adminMarkdownService = new AdminMarkdownService(connection);
      const response = await adminMarkdownService.getMarkdowns(pagination, search);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getMarkdowns', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Express request handler to create a Markdown record.
 *
 * @returns {RequestHandler}
 */
export function createMarkdown(): RequestHandler {
  return async (req, res) => {
    const parsedBody = CreateMarkdown.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HTTP400('Invalid Markdown document.', parsedBody.error.errors);
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const adminMarkdownService = new AdminMarkdownService(connection);
      const markdown = await adminMarkdownService.createMarkdown(parsedBody.data);

      await connection.commit();

      return res.status(201).json(markdown);
    } catch (error) {
      defaultLog.error({ label: 'createMarkdown', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

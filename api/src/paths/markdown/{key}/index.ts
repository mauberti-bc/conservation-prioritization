import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { MarkdownKey } from '../../../models/markdown';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { ApiMarkdownSchema, MarkdownKeySchema } from '../../../openapi/schemas/markdown';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { MarkdownService } from '../../../services/markdown-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger(__filename);

/**
 * GET /markdown/{key}
 *
 * Returns a Markdown document by stable application key.
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
  getMarkdown()
];

GET.apiDoc = {
  description: 'Fetch a Markdown document by stable application key.',
  tags: ['markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'key',
      required: true,
      schema: MarkdownKeySchema,
      description: 'Stable application key of the Markdown document.'
    }
  ],
  responses: {
    200: {
      description: 'Markdown document returned successfully.',
      content: {
        'application/json': {
          schema: ApiMarkdownSchema
        }
      }
    },
    404: {
      description: 'Markdown document not found.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch a Markdown document.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function getMarkdown(): RequestHandler {
  return async (req, res) => {
    const parsedKey = MarkdownKey.safeParse(req.params.key);

    if (!parsedKey.success) {
      throw new HTTP400('Invalid Markdown document key.', parsedKey.error.errors);
    }

    const key = parsedKey.data;
    const connection = getDBConnection(req.keycloak_token);

    defaultLog.debug({ label: 'getMarkdown', message: `Fetching Markdown document ${key}` });

    try {
      await connection.open();

      const markdownService = new MarkdownService(connection);
      const markdown = await markdownService.getMarkdown(key);

      await connection.commit();

      return res.status(200).json(markdown);
    } catch (error) {
      defaultLog.error({ label: 'getMarkdown', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

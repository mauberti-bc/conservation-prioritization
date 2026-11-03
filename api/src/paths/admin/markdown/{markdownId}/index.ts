import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { UpdateMarkdown } from '../../../../models/markdown';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { AdminMarkdownSchema, MarkdownPatchSchema } from '../../../../openapi/schemas/markdown';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { AdminMarkdownService } from '../../../../services/admin-markdown-service';
import { getLogger } from '../../../../utils/logger';

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

const markdownIdParameter = {
  in: 'path',
  name: 'markdownId',
  required: true,
  schema: {
    type: 'string',
    format: 'uuid'
  },
  description: 'UUID of the Markdown document.'
};

export const GET: Operation = [authorizeRequestHandler(adminAuthorization), getMarkdown()];

GET.apiDoc = {
  description: 'Fetches one Markdown document for administration.',
  tags: ['admin', 'markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [markdownIdParameter],
  responses: {
    200: {
      description: 'Markdown document returned successfully.',
      content: {
        'application/json': {
          schema: AdminMarkdownSchema
        }
      }
    },
    404: {
      description: 'Markdown document not found.'
    },
    ...defaultErrorResponses
  }
};

export const PUT: Operation = [authorizeRequestHandler(adminAuthorization), updateMarkdown()];

PUT.apiDoc = {
  description: 'Updates a Markdown document.',
  tags: ['admin', 'markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [markdownIdParameter],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: MarkdownPatchSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Markdown document updated successfully.',
      content: {
        'application/json': {
          schema: AdminMarkdownSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [authorizeRequestHandler(adminAuthorization), deleteMarkdown()];

DELETE.apiDoc = {
  description: 'Deletes a Markdown document.',
  tags: ['admin', 'markdown'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [markdownIdParameter],
  responses: {
    204: {
      description: 'Markdown document deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch a Markdown record for administration.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function getMarkdown(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const adminMarkdownService = new AdminMarkdownService(connection);
      const markdown = await adminMarkdownService.getMarkdown(req.params.markdownId);

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

/**
 * Express request handler to update a Markdown record.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function updateMarkdown(): RequestHandler {
  return async (req, res) => {
    const parsedBody = UpdateMarkdown.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HTTP400('Invalid Markdown document.', parsedBody.error.errors);
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const adminMarkdownService = new AdminMarkdownService(connection);
      const markdown = await adminMarkdownService.updateMarkdown(req.params.markdownId, parsedBody.data);

      await connection.commit();

      return res.status(200).json(markdown);
    } catch (error) {
      defaultLog.error({ label: 'updateMarkdown', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Express request handler to delete a Markdown record.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function deleteMarkdown(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const adminMarkdownService = new AdminMarkdownService(connection);
      await adminMarkdownService.deleteMarkdown(req.params.markdownId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteMarkdown', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

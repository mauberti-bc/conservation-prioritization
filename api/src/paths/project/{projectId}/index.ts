import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { UpdateProject } from '../../../models/project';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { GetProjectSchema, UpdateProjectSchema } from '../../../openapi/schemas/project';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ProjectService } from '../../../services/project-service';
import { getLogger } from '../../../utils/logger';
import { UpdateProjectBody } from './project-update.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Project',
          projectId: req.params.projectId
        }
      ]
    };
  }),
  updateProject()
];

POST.apiDoc = {
  description: 'Updates a project by its ID.',
  tags: ['projects'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateProjectSchema
      }
    }
  },
  parameters: [
    {
      in: 'path',
      name: 'projectId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the project to update.'
    }
  ],
  responses: {
    200: {
      description: 'Project updated successfully.',
      content: {
        'application/json': {
          schema: GetProjectSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to update a project by its ID.
 *
 * @returns {RequestHandler}
 */
export function updateProject(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'updateProject' });

    const projectId = req.params.projectId as string;
    const body = req.body as UpdateProjectBody;
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const projectService = new ProjectService(connection);
      const updates: UpdateProject = {};

      if (body.name !== undefined) {
        updates.name = body.name;
      }

      if (body.description !== undefined) {
        updates.description = body.description;
      }

      const project = await projectService.updateProject(projectId, updates);

      await connection.commit();

      return res.status(200).json(project);
    } catch (error) {
      defaultLog.error({ label: 'updateProject', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

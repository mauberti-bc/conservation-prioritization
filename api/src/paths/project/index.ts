import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { CreateProject } from '../../models/project';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { CreateProjectSchema, GetProjectSchema } from '../../openapi/schemas/project';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ProjectService } from '../../services/project-service';
import { getUserGuid } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

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
  createProject()
];

POST.apiDoc = {
  description: 'Creates a new project in the system.',
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
        schema: CreateProjectSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Project created successfully.',
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
 * Create a new project in the system.
 *
 * @returns {RequestHandler}
 */
export function createProject(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'createProject' });

    const connection = getDBConnection(req.keycloak_token);
    const payload = req.body as CreateProject;

    try {
      await connection.open();

      const projectService = new ProjectService(connection);
      const project = await projectService.createProject(payload);

      await connection.commit();

      return res.status(201).json(project);
    } catch (error) {
      defaultLog.error({ label: 'createProject', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * GET /project
 *
 * Returns all projects available to the authenticated user.
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
  getProjects()
];

GET.apiDoc = {
  description: 'Fetches projects available to the authenticated user.',
  tags: ['projects'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of projects returned successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: GetProjectSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch all projects available to the authenticated user.
 *
 * @returns {RequestHandler}
 */
export function getProjects(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getProjects' });

    const connection = getDBConnection(req.keycloak_token);
    const profileGuid = getUserGuid(req.keycloak_token);

    try {
      await connection.open();

      const projectService = new ProjectService(connection);
      const projects = profileGuid ? await projectService.getProjectsForProfileGuid(profileGuid) : [];

      await connection.commit();

      return res.status(200).json(projects);
    } catch (error) {
      defaultLog.error({ label: 'getProjects', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

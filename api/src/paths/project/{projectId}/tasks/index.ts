import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { AddProjectTasksSchema } from '../../../../openapi/schemas/project-task';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ProjectTaskService } from '../../../../services/project-task-service';
import { getLogger } from '../../../../utils/logger';
import { AddProjectTasksBody } from './add-project-tasks.interface';

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
  addProjectTasks()
];

POST.apiDoc = {
  description: 'Adds one or more tasks to a project.',
  tags: ['projects', 'tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: AddProjectTasksSchema
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
    201: {
      description: 'Tasks added to project.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object'
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to add tasks to a project.
 *
 * @returns {RequestHandler}
 */
export function addProjectTasks(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'addProjectTasks' });

    const body = req.body as AddProjectTasksBody;
    const projectId = req.params.projectId as string;
    const taskIds = body.taskIds;

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const projectTaskService = new ProjectTaskService(connection);
      const projectTasks = await projectTaskService.addTasksToProject(projectId, taskIds);

      await connection.commit();

      return res.status(201).json(projectTasks);
    } catch (error) {
      defaultLog.error({ label: 'addProjectTasks', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

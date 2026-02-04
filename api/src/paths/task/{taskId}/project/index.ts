import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { AddTaskProjectsSchema } from '../../../../openapi/schemas/task-project';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ProjectTaskService } from '../../../../services/project-task-service';
import { getLogger } from '../../../../utils/logger';
import { AddTaskProjectsBody, AddTaskProjectsParams } from './add-task-projects.interface';

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
  addProjectsToTask()
];

POST.apiDoc = {
  description: 'Adds one or more projects to a task.',
  tags: ['tasks', 'projects'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: AddTaskProjectsSchema
      }
    }
  },
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to update.'
    }
  ],
  responses: {
    201: {
      description: 'Projects added to task.',
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
 * Express request handler to add projects to a task.
 *
 * @returns {RequestHandler}
 */
export function addProjectsToTask(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'addProjectsToTask' });

    const params = req.params as AddTaskProjectsParams;
    const body = req.body as AddTaskProjectsBody;
    const taskId = params.taskId;
    const projectIds = body.projectIds;

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const projectTaskService = new ProjectTaskService(connection);
      const projectTasks = await projectTaskService.addProjectsToTask(taskId, projectIds);

      await connection.commit();

      return res.status(201).json(projectTasks);
    } catch (error) {
      defaultLog.error({ label: 'addProjectsToTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

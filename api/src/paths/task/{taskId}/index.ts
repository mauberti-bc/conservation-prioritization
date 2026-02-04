import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { DeleteTask } from '../../../models/task';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { GetTaskSchema } from '../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TaskService } from '../../../services/task-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger(__filename);

/**
 * GET /task/{taskId}
 *
 * Returns a single task by its ID.
 */
export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  getTaskById()
];

GET.apiDoc = {
  description: 'Fetch a task by its ID.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to fetch.'
    }
  ],
  responses: {
    200: {
      description: 'Task returned successfully.',
      content: {
        'application/json': {
          schema: GetTaskSchema
        }
      }
    },
    404: {
      description: 'Task not found.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch a task by its ID.
 *
 * @returns {RequestHandler}
 */
export function getTaskById(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'getTaskById', message: `Fetching task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);

      const task = await taskService.getTaskById(taskId);

      await connection.commit();

      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'getTaskById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * DELETE /task/{taskId}
 *
 * Soft deletes a task by its ID.
 */
export const DELETE: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  deleteTask()
];

DELETE.apiDoc = {
  description: 'Soft delete a task by its ID.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to delete.'
    }
  ],
  responses: {
    204: {
      description: 'Task deleted successfully.'
    },
    404: {
      description: 'Task not found.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to soft delete a task by its ID.
 *
 * @returns {RequestHandler}
 */
export function deleteTask(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'deleteTask', message: `Deleting task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);

      // Attempt to delete the task
      const taskData: DeleteTask = { task_id: taskId };

      await taskService.deleteTask(taskData);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTask', message: 'error', error });
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  };
}

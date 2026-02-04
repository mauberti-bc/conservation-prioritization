import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema } from '../../../../openapi/schemas/task';
import { requireServiceKey } from '../../../../request-handlers/security/service-key';
import { TaskService } from '../../../../services/task-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger(__filename);

/**
 * GET /internal/task/{taskId}
 *
 * Returns a single task by its ID for internal workflows.
 */
export const GET: Operation = [requireServiceKey(), getTaskById()];

GET.apiDoc = {
  description: 'Internal endpoint for fetching a task by its ID.',
  tags: ['tasks', 'internal'],
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

    const connection = getAPIUserDBConnection();

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

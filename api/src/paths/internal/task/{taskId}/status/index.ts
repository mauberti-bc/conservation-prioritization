import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, TaskStatusUpdateSchema } from '../../../../openapi/schemas/task';
import { TaskService } from '../../../../services/task-service';
import { enforceInternalAuth } from '../../../../utils/internal-auth';
import { getLogger } from '../../../../utils/logger';
import { UpdateTaskStatusBody, UpdateTaskStatusParams } from './task-status.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [updateTaskStatus()];

POST.apiDoc = {
  description: 'Internal endpoint for updating task execution status.',
  tags: ['tasks', 'internal'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: TaskStatusUpdateSchema
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
    200: {
      description: 'Task status updated successfully.',
      content: {
        'application/json': {
          schema: GetTaskSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid internal authorization token.'
    },
    403: {
      description: 'Forbidden.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to update a task status from internal workflows.
 *
 * @returns {RequestHandler}
 */
export function updateTaskStatus(): RequestHandler {
  return async (req, res) => {
    const params = req.params as UpdateTaskStatusParams;
    const body = req.body as UpdateTaskStatusBody;
    const taskId = params.taskId;

    enforceInternalAuth(req.headers as Record<string, string | string[] | undefined>);

    defaultLog.debug({ label: 'updateTaskStatus', message: `Updating task ${taskId} status to ${body.status}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskService = new TaskService(connection);

      const updatedTask = await taskService.updateTaskStatus(taskId, {
        status: body.status,
        status_message: body.message ?? null
      });

      await connection.commit();

      return res.status(200).json(updatedTask);
    } catch (error) {
      defaultLog.error({ label: 'updateTaskStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

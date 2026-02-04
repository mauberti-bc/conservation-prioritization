import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import type { TaskStatus, UpdateTaskExecution } from '../../../../models/task';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, TaskStatusUpdateSchema } from '../../../../openapi/schemas/task';
import { TaskService } from '../../../../services/task-service';
import { enforceInternalAuth } from '../../../../utils/internal-auth';
import { getLogger } from '../../../../utils/logger';

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
    const taskId = req.params.taskId;
    const { status, message } = req.body as { status: TaskStatus; message?: string | null };

    enforceInternalAuth(req.headers as Record<string, string | string[] | undefined>);

    defaultLog.debug({ label: 'updateTaskStatus', message: `Updating task ${taskId} status to ${status}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskService = new TaskService(connection);

      const updates: UpdateTaskExecution = {
        status,
        status_message: message ?? null
      };

      await taskService.updateTaskExecution(taskId, updates);
      const updatedTask = await taskService.getTaskById(taskId);

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

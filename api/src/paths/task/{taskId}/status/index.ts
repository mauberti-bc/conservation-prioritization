import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, TaskStatusUpdateSchema } from '../../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../../services/task-orchestrator-service';
import { getLogger } from '../../../../utils/logger';
import { UpdateTaskStatusBody } from './task-status.interface';

const defaultLog = getLogger(__filename);

export const PUT: Operation = [
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
  retryTask()
];

PUT.apiDoc = {
  description: 'Retry a failed task by resubmitting to Prefect.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
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
      description: 'UUID of the task to retry.'
    }
  ],
  responses: {
    200: {
      description: 'Task resubmitted successfully.',
      content: {
        'application/json': {
          schema: GetTaskSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to retry a task.
 *
 * @returns {RequestHandler}
 */
export function retryTask(): RequestHandler {
  return async (req, res) => {
    const body = req.body as UpdateTaskStatusBody;
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'retryTask', message: `Retrying task ${taskId}` });

    if (!body?.status) {
      return res.status(400).json({ message: 'Status must be pending or draft to update task.' });
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const orchestrator = new TaskOrchestratorService(connection);
      const task = await orchestrator.retryTask(taskId, body.status);

      await connection.commit();

      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'retryTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { SubmitTaskRequest } from '../../../../models/task-orchestrator';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, SubmitTaskSchema } from '../../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../../services/task-orchestrator-service';
import { TaskRunService } from '../../../../services/task-run-service';
import { TaskService } from '../../../../services/task-service';
import { getLogger } from '../../../../utils/logger';
import { SubmitTaskBody, toSubmitTaskRequest } from './submit-task.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
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
  submitTask()
];

POST.apiDoc = {
  description:
    'Submits an explicit immutable optimization problem for an existing draft task.',
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
        schema: SubmitTaskSchema
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
      description: 'UUID of the task to submit.'
    }
  ],
  responses: {
    200: {
      description: 'Task submitted successfully.',
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
 * Submit an existing draft task.
 *
 * @returns {RequestHandler}
 */
export function submitTask(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId as string;
    const body = req.body as SubmitTaskBody;
    const payload: SubmitTaskRequest = toSubmitTaskRequest(body);

    defaultLog.debug({ label: 'submitTask', message: `Submitting task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      await new TaskOrchestratorService(connection).configureTaskForRun(taskId, payload);
      const runService = new TaskRunService(connection);
      const run = await runService.createQueuedRun(taskId, payload);
      await connection.commit();

      await connection.open();
      try {
        await runService.dispatchRun(run.task_run_id);
      } catch (dispatchError) {
        defaultLog.error({ label: 'submitTask', message: 'Run persisted but dispatch failed', dispatchError });
      }
      const task = await new TaskService(connection).getTaskById(taskId);
      await connection.commit();
      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'submitTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

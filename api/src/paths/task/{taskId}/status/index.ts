import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { ApiGeneralError } from '../../../../errors/api-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, TaskStatusUpdateSchema } from '../../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../../services/task-orchestrator-service';
import { TaskRunService } from '../../../../services/task-run-service';
import { TaskService } from '../../../../services/task-service';
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

    if (body?.status !== 'pending' && body?.status !== 'draft') {
      return res.status(400).json({ message: 'Status must be pending or draft to update task.' });
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      if (body.status === 'draft') {
        const task = await new TaskOrchestratorService(connection).retryTask(taskId, 'draft');
        await connection.commit();
        return res.status(200).json(task);
      }

      const taskService = new TaskService(connection);
      const runService = new TaskRunService(connection);
      const task = await taskService.getTaskById(taskId);
      const latestRun = task.latest_run;
      let runId: string;
      let publicationRevision: number | null = null;

      if (!latestRun) {
        throw new ApiGeneralError('No immutable optimization run exists to retry.', []);
      } else {
        runId = latestRun.task_run_id;
        const canonicalReady = latestRun.artifacts.some(
          (artifact) => artifact.type === 'canonical_result' && artifact.status === 'ready'
        );
        if (canonicalReady) {
          const prepared = await runService.retryPublication(runId);
          publicationRevision = prepared.revision;
        } else if (!['queued', 'failed'].includes(latestRun.status)) {
          throw new ApiGeneralError('Only queued or failed immutable runs can be retried.', []);
        }
      }

      await connection.commit();
      await connection.open();
      try {
        if (publicationRevision === null) {
          await runService.dispatchRun(runId);
        } else {
          await runService.dispatchPreparedPublication(runId, publicationRevision);
        }
      } catch (dispatchError) {
        if (publicationRevision !== null) {
          await runService.failPublication(runId, dispatchError);
        }
        await connection.commit();
        throw dispatchError;
      }
      const refreshedTask = await taskService.getTaskById(taskId);
      await connection.commit();
      return res.status(200).json(refreshedTask);
    } catch (error) {
      defaultLog.error({ label: 'retryTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

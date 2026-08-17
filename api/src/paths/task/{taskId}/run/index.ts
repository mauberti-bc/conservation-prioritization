import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { SubmitTaskRequest } from '../../../../models/task-orchestrator';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmitTaskSchema } from '../../../../openapi/schemas/task';
import { TaskRunSchema } from '../../../../openapi/schemas/task-run';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../../services/task-orchestrator-service';
import { TaskRunService } from '../../../../services/task-run-service';
import { getLogger } from '../../../../utils/logger';

const log = getLogger(__filename);
const authorization = authorizeRequestHandler((req) => ({
  and: [{ discriminator: 'Task', taskId: req.params.taskId }]
}));

export const GET: Operation = [authorization, listTaskRuns()];
GET.apiDoc = {
  description: 'List immutable runs for a task.',
  tags: ['task-runs'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'taskId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    200: {
      description: 'Task runs.',
      content: { 'application/json': { schema: { type: 'array', items: TaskRunSchema } } }
    },
    ...defaultErrorResponses
  }
};

/** Returns all runs for the task. */
export function listTaskRuns(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const runs = await new TaskRunService(connection).getTaskRunsByTaskId(req.params.taskId);
      await connection.commit();
      return res.status(200).json(runs);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [authorization, createTaskRun()];
POST.apiDoc = {
  description: 'Create and dispatch an immutable optimization run.',
  tags: ['task-runs'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'taskId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: { required: true, content: { 'application/json': { schema: SubmitTaskSchema } } },
  responses: {
    201: { description: 'Run created.', content: { 'application/json': { schema: TaskRunSchema } } },
    202: {
      description: 'Run persisted and awaiting dispatch recovery.',
      content: { 'application/json': { schema: TaskRunSchema } }
    },
    ...defaultErrorResponses
  }
};

/** Persists a run, commits it, and then attempts recoverable Prefect dispatch. */
export function createTaskRun(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    let runId: string | null = null;
    try {
      await connection.open();
      await new TaskOrchestratorService(connection).configureTaskForRun(
        req.params.taskId,
        req.body as SubmitTaskRequest
      );
      const service = new TaskRunService(connection);
      const run = await service.createQueuedRun(req.params.taskId, req.body as SubmitTaskRequest);
      runId = run.task_run_id;
      await connection.commit();

      await connection.open();
      try {
        await service.dispatchRun(run.task_run_id);
      } catch (dispatchError) {
        const persisted = await service.getTaskRunById(run.task_run_id);
        await connection.commit();
        log.error({
          label: 'createTaskRun',
          message: 'Run persisted but dispatch failed',
          error: dispatchError,
          runId
        });
        return res.status(202).json(persisted);
      }
      const dispatched = await service.getTaskRunById(run.task_run_id);
      await connection.commit();
      return res.status(201).json(dispatched);
    } catch (error) {
      await connection.rollback();
      if (runId) {
        await connection.open();
        const persisted = await new TaskRunService(connection).getTaskRunById(runId);
        await connection.commit();
        log.error({ label: 'createTaskRun', message: 'Run persisted but dispatch failed', error, runId });
        return res.status(202).json(persisted);
      }
      throw error;
    } finally {
      connection.release();
    }
  };
}

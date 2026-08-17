import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskRunSchema } from '../../../../openapi/schemas/task-run';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskRunService } from '../../../../services/task-run-service';

const authorization = authorizeRequestHandler((req) => ({
  and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }]
}));

export const POST: Operation = [authorization, retryRunPublication()];
POST.apiDoc = {
  description: 'Retry failed or interrupted publication for a successfully solved canonical run.',
  tags: ['task-runs'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    202: { description: 'Publication retry dispatched.', content: { 'application/json': { schema: TaskRunSchema } } },
    ...defaultErrorResponses
  }
};

/** Dispatches recoverable publication without repeating the global solve. */
export function retryRunPublication(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new TaskRunService(connection);
      const run = await service.retryPublication(req.params.runId);
      await connection.commit();
      try {
        await service.dispatchPreparedPublication(run.task_run_id, run.revision);
      } catch (dispatchError) {
        await connection.open();
        await service.failPublication(run.task_run_id, dispatchError);
        await connection.commit();
        throw dispatchError;
      }
      await connection.open();
      const response = await service.getTaskRunById(run.task_run_id);
      await connection.commit();
      return res.status(202).json(response);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

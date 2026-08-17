import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TaskRunSchema } from '../../../../../openapi/schemas/task-run';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskRunService } from '../../../../../services/task-run-service';

export const POST: Operation = [requireServiceKey(), publishTaskRun()];
POST.apiDoc = {
  description: 'Dispatch run-scoped PMTiles publication from the canonical result.',
  tags: ['task-runs', 'internal'],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    202: { description: 'Publication dispatched.', content: { 'application/json': { schema: TaskRunSchema } } },
    ...defaultErrorResponses
  }
};

/** Dispatches the independently retryable task-tile deployment. */
export function publishTaskRun(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const service = new TaskRunService(connection);
      const prepared = await service.preparePublication(req.params.runId);
      await connection.commit();
      try {
        await service.dispatchPreparedPublication(req.params.runId, prepared.revision);
      } catch (dispatchError) {
        await connection.open();
        await service.failPublication(req.params.runId, dispatchError);
        await connection.commit();
        throw dispatchError;
      }
      await connection.open();
      const response = await service.getTaskRunById(req.params.runId);
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskRunSchema } from '../../../../openapi/schemas/task-run';
import { requireServiceKey } from '../../../../request-handlers/security/service-key';
import { TaskRunService } from '../../../../services/task-run-service';

export const GET: Operation = [requireServiceKey(), getInternalRun()];
GET.apiDoc = {
  description: 'Resolve an immutable run for an internal workflow.',
  tags: ['task-runs', 'internal'],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    200: { description: 'Task run.', content: { 'application/json': { schema: TaskRunSchema } } },
    ...defaultErrorResponses
  }
};

/** Returns a run to a service-key-authenticated workflow. */
export function getInternalRun(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const run = await new TaskRunService(connection).getTaskRunById(req.params.runId);
      await connection.commit();
      return res.status(200).json(run);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

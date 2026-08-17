import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { TaskRunSchema } from '../../../openapi/schemas/task-run';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TaskRunService } from '../../../services/task-run-service';

export const GET: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }] })),
  getTaskRun()
];
GET.apiDoc = {
  description: 'Get an immutable task run and its artifacts.',
  tags: ['task-runs'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    200: { description: 'Task run.', content: { 'application/json': { schema: TaskRunSchema } } },
    ...defaultErrorResponses
  }
};

/** Returns one authorized run. */
export function getTaskRun(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
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

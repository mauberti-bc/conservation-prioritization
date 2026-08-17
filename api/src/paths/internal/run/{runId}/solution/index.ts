import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { TaskRunSolutionRole, UpsertTaskRunSolution } from '../../../../../models/task-run-solution';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TaskRunSchema } from '../../../../../openapi/schemas/task-run';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskRunService } from '../../../../../services/task-run-service';

export const POST: Operation = [requireServiceKey(), upsertRunSolution()];
POST.apiDoc = {
  description: 'Create or update normalized metadata for one run-local solution.',
  tags: ['task-runs', 'internal'],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
  },
  responses: {
    200: { description: 'Updated run.', content: { 'application/json': { schema: TaskRunSchema } } },
    ...defaultErrorResponses
  }
};

/** Validates and persists normalized solution metadata from a workflow. */
export function upsertRunSolution(): RequestHandler {
  return async (req, res) => {
    const payload: UpsertTaskRunSolution = {
      ...req.body,
      solution_index: Number(req.body.solution_index),
      role: TaskRunSolutionRole.parse(req.body.role)
    };
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const run = await new TaskRunService(connection).upsertSolution(req.params.runId, payload);
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

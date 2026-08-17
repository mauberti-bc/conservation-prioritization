import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskRunService } from '../../../../../services/task-run-service';

export const POST: Operation = [requireServiceKey(), updateInternalRun()];
POST.apiDoc = {
  description: 'Update run lifecycle and solver metadata.',
  tags: ['task-runs', 'internal'],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
            stage: {
              type: 'string',
              enum: [
                'counting',
                'preparing',
                'admitting',
                'compiling',
                'solving',
                'materializing',
                'exporting',
                'publishing'
              ],
              nullable: true
            },
            solver_status: { type: 'string', nullable: true },
            solver_name: { type: 'string', nullable: true },
            solver_version: { type: 'string', nullable: true },
            objective_value: { type: 'number', nullable: true },
            optimality_gap: { type: 'number', nullable: true },
            runtime_seconds: { type: 'number', nullable: true },
            preliminary_estimate: { type: 'object', additionalProperties: true, nullable: true },
            admission_outcome: { type: 'object', additionalProperties: true, nullable: true },
            progress: { type: 'object', additionalProperties: true, nullable: true },
            planning_unit_count: { type: 'integer', format: 'int64', nullable: true },
            feature_nonzero_count: { type: 'integer', format: 'int64', nullable: true },
            neighbor_edge_count: { type: 'integer', format: 'int64', nullable: true },
            failure_code: { type: 'string', nullable: true },
            failure_message: { type: 'string', nullable: true }
          }
        }
      }
    }
  },
  responses: {
    200: { description: 'Updated run.', content: { 'application/json': { schema: { type: 'object' } } } },
    ...defaultErrorResponses
  }
};

/** Applies an internal run lifecycle update. */
export function updateInternalRun(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      await new TaskRunService(connection).updateRun(req.params.runId, req.body);
      await connection.commit();
      return res.status(200).json({ ok: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

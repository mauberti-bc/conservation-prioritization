import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../../database/db';
import { ArtifactType } from '../../../../../../models/artifact';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { requireServiceKey } from '../../../../../../request-handlers/security/service-key';
import { TaskRunService } from '../../../../../../services/task-run-service';

export const POST: Operation = [requireServiceKey(), updateRunArtifact()];
POST.apiDoc = {
  description: 'Update and finalize a run artifact.',
  tags: ['task-runs', 'internal'],
  parameters: [
    { in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } },
    { in: 'path', name: 'artifactType', required: true, schema: { type: 'string' } }
  ],
  requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
  responses: {
    200: { description: 'Updated artifact.', content: { 'application/json': { schema: { type: 'object' } } } },
    ...defaultErrorResponses
  }
};

/** Validates the artifact role and applies an internal update. */
export function updateRunArtifact(): RequestHandler {
  return async (req, res) => {
    const type = ArtifactType.parse(req.params.artifactType);
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      await new TaskRunService(connection).updateArtifact(req.params.runId, type, req.body);
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

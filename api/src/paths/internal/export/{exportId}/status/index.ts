import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskExportService } from '../../../../../services/task-export-service';

export const POST: Operation = [requireServiceKey(), updateInternalTaskExport()];
POST.apiDoc = {
  description: 'Update export lifecycle state from an internal worker.',
  tags: ['task-exports', 'internal'],
  parameters: [{ in: 'path', name: 'exportId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
  },
  responses: {
    200: { description: 'Updated export.', content: { 'application/json': { schema: { type: 'object' } } } },
    ...defaultErrorResponses
  }
};

/** Applies a guarded export lifecycle update. */
export function updateInternalTaskExport(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      await new TaskExportService(connection).updateExportFromWorker(
        req.params.exportId,
        Number(req.body.attempt),
        req.body
      );
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

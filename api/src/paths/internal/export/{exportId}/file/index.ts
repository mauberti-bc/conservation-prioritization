import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskExportService } from '../../../../../services/task-export-service';

export const POST: Operation = [requireServiceKey(), createInternalTaskExportFile()];
POST.apiDoc = {
  description: 'Record one durably uploaded export file from an internal worker.',
  tags: ['task-exports', 'internal'],
  parameters: [{ in: 'path', name: 'exportId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
  },
  responses: {
    200: { description: 'Created export file.', content: { 'application/json': { schema: { type: 'object' } } } },
    ...defaultErrorResponses
  }
};

/** Records one durable export file after upload. */
export function createInternalTaskExportFile(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const file = await new TaskExportService(connection).createExportFileFromWorker(
        req.params.exportId,
        Number(req.body.attempt),
        {
          ...req.body,
          task_export_id: req.params.exportId
        }
      );
      await connection.commit();
      return res.status(200).json(file);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import { TaskExportDownloadSchema } from '../../../../../../../../openapi/schemas/task-export';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { TaskExportService } from '../../../../../../../../services/task-export-service';

export const GET: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }] })),
  getTaskExportFileDownload()
];
GET.apiDoc = {
  description: 'Get a presigned download URL for one export file.',
  tags: ['task-exports'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } },
    { in: 'path', name: 'exportId', required: true, schema: { type: 'string', format: 'uuid' } },
    { in: 'path', name: 'exportFileId', required: true, schema: { type: 'string', format: 'uuid' } }
  ],
  responses: {
    200: {
      description: 'Presigned download URL.',
      content: { 'application/json': { schema: TaskExportDownloadSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Returns a fresh presigned URL for one authorized export file.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function getTaskExportFileDownload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const download = await new TaskExportService(connection).getDownloadUrl(
        req.params.runId,
        req.params.exportId,
        req.params.exportFileId
      );
      await connection.commit();
      return res.status(200).json(download);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

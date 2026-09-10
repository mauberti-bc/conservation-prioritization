import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TaskExportSchema } from '../../../../../openapi/schemas/task-export';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TaskExportService } from '../../../../../services/task-export-service';

export const GET: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }] })),
  getTaskExport()
];
GET.apiDoc = {
  description: 'Get one export for a task run.',
  tags: ['task-exports'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } },
    { in: 'path', name: 'exportId', required: true, schema: { type: 'string', format: 'uuid' } }
  ],
  responses: {
    200: { description: 'Task export.', content: { 'application/json': { schema: TaskExportSchema } } },
    ...defaultErrorResponses
  }
};

/** Returns one authorized task export. */
export function getTaskExport(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const taskExport = await new TaskExportService(connection).getTaskExportByRunId(
        req.params.runId,
        req.params.exportId
      );
      await connection.commit();
      return res.status(200).json(taskExport);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

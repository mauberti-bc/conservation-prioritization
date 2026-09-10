import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { requireServiceKey } from '../../../../request-handlers/security/service-key';
import { TaskExportService } from '../../../../services/task-export-service';
import { TaskRunService } from '../../../../services/task-run-service';

export const GET: Operation = [requireServiceKey(), getInternalTaskExport()];
GET.apiDoc = {
  description: 'Get one export and its parent run for worker execution.',
  tags: ['task-exports', 'internal'],
  parameters: [{ in: 'path', name: 'exportId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    200: { description: 'Export execution context.', content: { 'application/json': { schema: { type: 'object' } } } },
    ...defaultErrorResponses
  }
};

/** Returns export execution context for internal workers. */
export function getInternalTaskExport(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const taskExport = await new TaskExportService(connection).getTaskExportById(req.params.exportId);
      const run = await new TaskRunService(connection).getTaskRunById(taskExport.task_run_id);
      await connection.commit();
      return res.status(200).json({ export: taskExport, run });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

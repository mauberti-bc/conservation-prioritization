import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { TaskExportFormat } from '../../../../models/task-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskExportSchema } from '../../../../openapi/schemas/task-export';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskExportService } from '../../../../services/task-export-service';

export const GET: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }] })),
  getTaskExports()
];
GET.apiDoc = {
  description: 'List exports for a task run.',
  tags: ['task-exports'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    200: {
      description: 'Task exports.',
      content: { 'application/json': { schema: { type: 'array', items: TaskExportSchema } } }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'TaskRun', taskRunId: req.params.runId }] })),
  createTaskExport()
];
POST.apiDoc = {
  description: 'Create and dispatch an export for a task run.',
  tags: ['task-exports'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string', format: 'uuid' } }],
  requestBody: {
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['geotiff', 'geodatabase'] }
          },
          additionalProperties: false
        }
      }
    }
  },
  responses: {
    201: { description: 'Queued task export.', content: { 'application/json': { schema: TaskExportSchema } } },
    ...defaultErrorResponses
  }
};

/** Lists exports for one authorized task run. */
export function getTaskExports(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const exports = await new TaskExportService(connection).getTaskExportsByRunId(req.params.runId);
      await connection.commit();
      return res.status(200).json(exports);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/** Creates and dispatches one GeoTIFF export. */
export function createTaskExport(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const format = TaskExportFormat.optional().parse(req.body?.format) ?? 'geotiff';
      const service = new TaskExportService(connection);
      const taskExport = await service.createQueuedExport(req.params.runId, format);
      await connection.commit();
      connection.release();

      await connection.open();
      let dispatchedExport;
      try {
        dispatchedExport = await service.dispatchQueuedExport(taskExport.task_export_id);
      } catch (error) {
        // Preserve a dispatch failure so it remains visible and can be retried as a new export.
        await connection.commit();
        throw error;
      }
      await connection.commit();
      return res.status(201).json(dispatchedExport);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

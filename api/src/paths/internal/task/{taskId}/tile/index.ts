import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TaskTileSchema } from '../../../../../openapi/schemas/task-tile';
import { requireServiceKey } from '../../../../../request-handlers/security/service-key';
import { TaskTileService } from '../../../../../services/task-tile-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger(__filename);

export const POST: Operation = [requireServiceKey(), createTaskTile()];

POST.apiDoc = {
  description: 'Internal endpoint for creating a draft task tile record.',
  tags: ['tasks', 'internal'],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to tile.'
    }
  ],
  responses: {
    201: {
      description: 'Task tile record created.',
      content: {
        'application/json': {
          schema: TaskTileSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to create a draft task tile record.
 *
 * @returns {RequestHandler}
 */
export function createTaskTile(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'createTaskTile', message: `Creating draft tile for task ${taskId}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskTileService = new TaskTileService(connection);
      const taskTile = await taskTileService.createDraftTileAndSubmit(taskId);
      await connection.commit();

      return res.status(201).json(taskTile);
    } catch (error) {
      defaultLog.error({ label: 'createTaskTile', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

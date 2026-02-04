import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskTileSchema } from '../../../../openapi/schemas/task-tile';
import { TaskTileService } from '../../../../services/task-tile-service';
import { enforceInternalAuth } from '../../../../utils/internal-auth';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger(__filename);

export const POST: Operation = [createTaskTile()];

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
    401: {
      description: 'Missing or invalid internal authorization token.'
    },
    403: {
      description: 'Forbidden.'
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

    enforceInternalAuth(req.headers as Record<string, string | string[] | undefined>);

    defaultLog.debug({ label: 'createTaskTile', message: `Creating draft tile for task ${taskId}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskTileService = new TaskTileService(connection);
      const taskTile = await taskTileService.createDraftTileRecord(taskId);
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

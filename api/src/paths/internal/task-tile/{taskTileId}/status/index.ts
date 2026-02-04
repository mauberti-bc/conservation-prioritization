import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import type { TaskTileStatus } from '../../../../models/task-tile';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskTileSchema, TaskTileStatusUpdateSchema } from '../../../../openapi/schemas/task-tile';
import { TaskTileService } from '../../../../services/task-tile-service';
import { enforceInternalAuth } from '../../../../utils/internal-auth';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger(__filename);

export const POST: Operation = [updateTaskTileStatus()];

POST.apiDoc = {
  description: 'Internal endpoint for updating task tile status.',
  tags: ['tasks', 'internal'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: TaskTileStatusUpdateSchema
      }
    }
  },
  parameters: [
    {
      in: 'path',
      name: 'taskTileId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task tile to update.'
    }
  ],
  responses: {
    200: {
      description: 'Task tile updated successfully.',
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
 * Express request handler to update task tile status.
 *
 * @returns {RequestHandler}
 */
export function updateTaskTileStatus(): RequestHandler {
  return async (req, res) => {
    const taskTileId = req.params.taskTileId;
    const { status, uri, content_type, error_code, error_message } = req.body as {
      status: TaskTileStatus;
      uri?: string | null;
      content_type?: string | null;
      error_code?: string | null;
      error_message?: string | null;
    };

    enforceInternalAuth(req.headers as Record<string, string | string[] | undefined>);

    defaultLog.debug({ label: 'updateTaskTileStatus', message: `Updating task tile ${taskTileId} to ${status}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskTileService = new TaskTileService(connection);

      let updatedTile;

      if (status === 'STARTED') {
        updatedTile = await taskTileService.markTileStarted(taskTileId);
      } else if (status === 'COMPLETED') {
        if (!uri) {
          throw new HTTP400('Tile completion requires a uri.');
        }
        updatedTile = await taskTileService.markTileCompleted(taskTileId, uri, content_type ?? null);
      } else if (status === 'FAILED') {
        updatedTile = await taskTileService.markTileFailed(taskTileId, error_code ?? null, error_message ?? null);
      } else {
        updatedTile = await taskTileService.markTileFailed(taskTileId, 'invalid_status', 'Unsupported status update.');
      }

      await connection.commit();
      return res.status(200).json(updatedTile);
    } catch (error) {
      defaultLog.error({ label: 'updateTaskTileStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

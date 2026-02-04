import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TaskTileSchema, TaskTileStatusUpdateSchema } from '../../../../openapi/schemas/task-tile';
import { requireServiceKey } from '../../../../request-handlers/security/service-key';
import { TaskTileService } from '../../../../services/task-tile-service';
import { getLogger } from '../../../../utils/logger';
import { UpdateTaskTileStatusBody } from './task-tile-status.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [requireServiceKey(), updateTaskTileStatus()];

POST.apiDoc = {
  description: 'Endpoint for updating task tile status.',
  tags: ['tasks'],
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
    const body = req.body as UpdateTaskTileStatusBody;
    const taskTileId = req.params.taskTileId;

    defaultLog.debug({ label: 'updateTaskTileStatus', message: `Updating task tile ${taskTileId} to ${body.status}` });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskTileService = new TaskTileService(connection);

      const updatedTile = await taskTileService.updateTileStatus(taskTileId, body);

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

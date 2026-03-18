import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { DeleteTask, UpdateTask } from '../../../models/task';
import { SubmitTaskRequest } from '../../../models/task-orchestrator';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { GetTaskSchema, UpdateTaskSchema } from '../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../services/task-orchestrator-service';
import { TaskService } from '../../../services/task-service';
import { getLogger } from '../../../utils/logger';
import { UpdateTaskBody } from './task-update.interface';

const defaultLog = getLogger(__filename);

/**
 * GET /task/{taskId}
 *
 * Returns a single task by its ID.
 */
export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  getTaskById()
];

GET.apiDoc = {
  description: 'Fetch a task by its ID.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to fetch.'
    }
  ],
  responses: {
    200: {
      description: 'Task returned successfully.',
      content: {
        'application/json': {
          schema: GetTaskSchema
        }
      }
    },
    404: {
      description: 'Task not found.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch a task by its ID.
 *
 * @returns {RequestHandler}
 */
export function getTaskById(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'getTaskById', message: `Fetching task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);

      const task = await taskService.getTaskById(taskId);

      await connection.commit();

      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'getTaskById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * PUT /task/{taskId}
 *
 * Updates a task by its ID.
 */
export const PUT: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  updateTask()
];

PUT.apiDoc = {
  description: 'Update a task by its ID.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateTaskSchema
      }
    }
  },
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to update.'
    }
  ],
  responses: {
    200: {
      description: 'Task updated successfully.',
      content: {
        'application/json': {
          schema: GetTaskSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to update a task by its ID.
 *
 * @returns {RequestHandler}
 */
export function updateTask(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId as string;
    const body = req.body as UpdateTaskBody;

    defaultLog.debug({ label: 'updateTask', message: `Updating task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);
      const taskOrchestratorService = new TaskOrchestratorService(connection);
      const updates: UpdateTask = {};

      if (body.name !== undefined) {
        updates.name = body.name;
      }

      if (body.description !== undefined) {
        updates.description = body.description;
      }

      if (body.resolution !== undefined) {
        updates.resolution = body.resolution ?? undefined;
      }

      if (body.resampling !== undefined) {
        updates.resampling = body.resampling ?? undefined;
      }

      if (body.variant !== undefined) {
        updates.variant = body.variant ?? undefined;
      }

      if (body.layers !== undefined || body.budget !== undefined) {
        const layerConfigRequest: SubmitTaskRequest = {
          layers: body.layers ?? [],
          budget: body.budget
        };

        await taskOrchestratorService.configureTaskLayers(taskId, layerConfigRequest);
      }

      if (Object.keys(updates).length > 0) {
        await taskService.updateTask(taskId, updates);
      }

      if (body.status !== undefined) {
        await taskService.updateTaskExecution(taskId, {
          status: body.status
        });
      }

      const task = await taskService.getTaskById(taskId);

      await connection.commit();

      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'updateTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * DELETE /task/{taskId}
 *
 * Soft deletes a task by its ID.
 */
export const DELETE: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Task',
          taskId: req.params.taskId
        }
      ]
    };
  }),
  deleteTask()
];

DELETE.apiDoc = {
  description: 'Soft delete a task by its ID.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'taskId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'UUID of the task to delete.'
    }
  ],
  responses: {
    204: {
      description: 'Task deleted successfully.'
    },
    404: {
      description: 'Task not found.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to soft delete a task by its ID.
 *
 * @returns {RequestHandler}
 */
export function deleteTask(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId;

    defaultLog.debug({ label: 'deleteTask', message: `Deleting task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);

      // Attempt to delete the task
      const taskData: DeleteTask = { task_id: taskId };

      await taskService.deleteTask(taskData);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTask', message: 'error', error });
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  };
}

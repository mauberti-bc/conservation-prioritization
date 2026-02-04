import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { HTTP500 } from '../../errors/http-error';
import { PrefectSubmissionError } from '../../errors/prefect-error';
import { CreateTaskRequest } from '../../models/task-orchestrator';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { CreateTaskSchema, GetTaskSchema } from '../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../services/task-orchestrator-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'Profile'
        }
      ]
    };
  }),
  createTask()
];

POST.apiDoc = {
  description: 'Creates a new task in the system, with optional layers and constraints.',
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
        schema: CreateTaskSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Task created successfully.',
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
 * Create a new task in the system, including optional layers and constraints.
 *
 * @returns {RequestHandler}
 */
export function createTask(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'createTask' });

    const connection = getDBConnection(req.keycloak_token);
    const payload = req.body as CreateTaskRequest;

    try {
      await connection.open();

      const taskService = new TaskOrchestratorService(connection);
      const taskResponse = await taskService.createTaskAndSubmit(payload);

      await connection.commit();

      return res.status(201).json(taskResponse);
    } catch (error) {
      defaultLog.error({ label: 'createTask', message: 'error', error });

      if (error instanceof PrefectSubmissionError) {
        await connection.commit();
        throw new HTTP500(error.message);
      }

      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * GET /tasks
 *
 * Returns all tasks in the system.
 */
export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'Profile'
        }
      ]
    };
  }),
  getTasks()
];

GET.apiDoc = {
  description: 'Fetches all tasks in the system.',
  tags: ['tasks'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of tasks returned successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: GetTaskSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Express request handler to fetch all tasks.
 *
 * @returns {RequestHandler}
 */
export function getTasks(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getTasks' });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskService = new TaskService(connection);

      const tasks = await taskService.getAllTasks();

      await connection.commit();

      return res.status(200).json(tasks);
    } catch (error) {
      defaultLog.error({ label: 'getTasks', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

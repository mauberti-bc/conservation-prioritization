import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { CreateTaskDraftRequest } from '../../models/task-orchestrator';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../openapi/schemas/pagination';
import { CreateTaskDraftSchema, GetTaskSchema } from '../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../services/task-orchestrator-service';
import { TaskService } from '../../services/task-service';
import { getLogger } from '../../utils/logger';
import { ensureCompletePaginationOptions, makePaginationOptionsFromRequest } from '../../utils/pagination';

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
  description: 'Creates a new task in the system.',
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
        schema: CreateTaskDraftSchema
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
 * Create a new task in the system.
 *
 * @returns {RequestHandler}
 */
export function createTask(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'createTask' });

    const connection = getDBConnection(req.keycloak_token);
    const payload = req.body as CreateTaskDraftRequest;

    try {
      await connection.open();

      const profileId = connection.profileId();
      const taskService = new TaskOrchestratorService(connection);
      const taskResponse = await taskService.createDraftTask(payload, profileId);

      await connection.commit();

      return res.status(201).json(taskResponse);
    } catch (error) {
      defaultLog.error({ label: 'createTask', message: 'error', error });
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
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      description: 'Case-insensitive task name/description search term.',
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'List of tasks returned successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['tasks', 'pagination'],
            properties: {
              tasks: {
                type: 'array',
                items: GetTaskSchema
              },
              pagination: paginationResponseSchema
            }
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

      const profileId = connection.profileId();

      const taskService = new TaskService(connection);
      const paginationRequest = makePaginationOptionsFromRequest(req);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const pagination = ensureCompletePaginationOptions(paginationRequest) ?? { page: 1, limit: 25 };

      const tasks = await taskService.getTasksForProfilePaginated(profileId, pagination, search);

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

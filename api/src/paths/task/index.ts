import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import type { Task, UpdateTaskExecution } from '../../models/task';
import { CreateTaskRequest } from '../../models/task-orchestrator';
import type { TaskWithLayers } from '../../models/task.interface';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { CreateTaskSchema, GetTaskSchema } from '../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { PrefectService } from '../../services/prefect-service';
import { TaskOrchestratorService } from '../../services/task-orchestrator-service';
import { TaskService } from '../../services/task-service';
import { getLogger } from '../../utils/logger';
import { buildOptimizationParameters } from '../../utils/task-optimization';

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
    let taskResponse: TaskWithLayers;

    try {
      await connection.open();

      const taskService = new TaskOrchestratorService(connection);

      taskResponse = await taskService.createTask(payload);

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'createTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const prefectService = new PrefectService();
    const optimizationParameters = buildOptimizationParameters(payload);

    let deploymentId: string;
    let flowRunId: string;

    try {
      ({ deploymentId, flowRunId } = await prefectService.submitStrictOptimization(
        taskResponse.task_id,
        optimizationParameters
      ));
    } catch (error) {
      defaultLog.error({ label: 'createTask', message: 'prefect submission failed', error });

      await updateTaskExecution(req.keycloak_token, taskResponse.task_id, {
        status: 'failed_to_submit',
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      throw error;
    }

    const updatedTask = await updateTaskExecution(req.keycloak_token, taskResponse.task_id, {
      status: 'submitted',
      status_message: null,
      prefect_flow_run_id: flowRunId,
      prefect_deployment_id: deploymentId
    });

    return res.status(201).json({ ...taskResponse, ...updatedTask });
  };
}

/**
 * Updates task execution metadata using a dedicated connection.
 *
 * @param {any} keycloakToken - Keycloak token payload.
 * @param {string} taskId - Task ID to update.
 * @param {UpdateTaskExecution} updates - Updates to apply.
 * @return {*} {Promise<Task>} Updated task record.
 */
async function updateTaskExecution(keycloakToken: any, taskId: string, updates: UpdateTaskExecution): Promise<Task> {
  const statusConnection = getDBConnection(keycloakToken);

  try {
    await statusConnection.open();
    const taskService = new TaskService(statusConnection);
    const updatedTask = await taskService.updateTaskExecution(taskId, updates);
    await statusConnection.commit();
    return updatedTask;
  } catch (error) {
    defaultLog.error({ label: 'updateTaskExecution', message: 'error', error });
    await statusConnection.rollback();
    throw error;
  } finally {
    statusConnection.release();
  }
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

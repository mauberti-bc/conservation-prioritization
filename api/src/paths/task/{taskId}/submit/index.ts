import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { SubmitTaskRequest } from '../../../../models/task-orchestrator';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { GetTaskSchema, SubmitTaskSchema } from '../../../../openapi/schemas/task';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskOrchestratorService } from '../../../../services/task-orchestrator-service';
import { getLogger } from '../../../../utils/logger';
import { SubmitTaskBody } from './submit-task.interface';

const defaultLog = getLogger(__filename);

export const POST: Operation = [
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
  submitTask()
];

POST.apiDoc = {
  description:
    'Submits an existing draft task to Prefect with optional configuration updates. At least one non-budget layer must exist after merge.',
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
        schema: SubmitTaskSchema
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
      description: 'UUID of the task to submit.'
    }
  ],
  responses: {
    200: {
      description: 'Task submitted successfully.',
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
 * Submit an existing draft task.
 *
 * @returns {RequestHandler}
 */
export function submitTask(): RequestHandler {
  return async (req, res) => {
    const taskId = req.params.taskId as string;
    const body = req.body as SubmitTaskBody;
    const payload: SubmitTaskRequest = {
      layers: body.layers,
      budget: body.budget,
      geometry: body.geometry,
      resolution: body.resolution,
      resampling: body.resampling,
      variant: body.variant,
      target_area: body.target_area,
      is_percentage: body.is_percentage
    };

    defaultLog.debug({ label: 'submitTask', message: `Submitting task ${taskId}` });

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const taskOrchestratorService = new TaskOrchestratorService(connection);
      const task = await taskOrchestratorService.submitExistingTask(taskId, payload);

      await connection.commit();

      return res.status(200).json(task);
    } catch (error) {
      defaultLog.error({ label: 'submitTask', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

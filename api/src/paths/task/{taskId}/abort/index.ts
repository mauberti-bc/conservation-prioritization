import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TaskService } from '../../../../services/task-service';

export const POST: Operation = [
  authorizeRequestHandler((req) => ({ and: [{ discriminator: 'Task', taskId: req.params.taskId }] })),
  abortTask()
];
POST.apiDoc = {
  description: 'Request cancellation of the Prefect flow associated with a task.',
  tags: ['task'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'taskId', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: {
    202: { description: 'Cancellation requested. The flow may still be stopping.' },
    ...defaultErrorResponses
  }
};

/**
 * Requests cancellation for an authorized task; propagates database and Prefect failures.
 *
 * @returns {RequestHandler} Express handler that processes the request and sends the response.
 */
export function abortTask(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      await new TaskService(connection).abortTask(req.params.taskId);
      await connection.commit();
      return res.status(202).send();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { SubmitTaskRequest } from '../../../../models/task-orchestrator';

/**
 * Request body for submitting an existing draft task.
 */
export type SubmitTaskBody = SubmitTaskRequest;

/**
 * Preserves every validated task-submission field at the HTTP boundary.
 *
 * @param {SubmitTaskBody} body Validated request body received from Express OpenAPI.
 * @returns {SubmitTaskRequest} Complete request passed to task configuration and immutable run creation.
 */
export function toSubmitTaskRequest(body: SubmitTaskBody): SubmitTaskRequest {
  return { ...body };
}

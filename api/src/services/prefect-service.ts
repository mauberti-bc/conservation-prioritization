import axios, { AxiosInstance } from 'axios';
import { ApiGeneralError } from '../errors/api-error';
import { TaskType } from '../models/task';
import { TaskRunExecutionMethod } from '../models/task-run';
import { getLogger } from '../utils/logger';
import { PrefectStateTransitionResponse } from './prefect-service.interface';

const defaultLog = getLogger(__filename);

interface PrefectDeploymentResponse {
  id: string;
}

interface PrefectFlowRunResponse {
  id: string;
}

/**
 * Service for interacting with Prefect API.
 *
 * @export
 * @class PrefectService
 */
export class PrefectService {
  private axios: AxiosInstance;

  /**
   * Creates an instance of PrefectService.
   *
   * @throws {ApiGeneralError} PREFECT_API_URL is not set.
   * @memberof PrefectService
   */
  constructor() {
    const baseUrl = process.env.PREFECT_API_URL;

    if (!baseUrl) {
      throw new ApiGeneralError('PREFECT_API_URL is not set', ['PrefectService']);
    }

    this.axios = axios.create({
      baseURL: baseUrl,
      headers: this.buildHeaders()
    });
  }

  /**
   * Requests worker cancellation without forcing a terminal state.
   *
   * @param {string} flowRunId Prefect flow run associated with the task.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @throws {ApiGeneralError} If Prefect is unavailable or refuses cancellation.
   * @throws {ApiGeneralError} Prefect did not accept the cancellation request.
   * @throws {ApiGeneralError} Failed to cancel Prefect flow run.
   */
  async cancelFlowRun(flowRunId: string): Promise<void> {
    try {
      const { data } = await this.axios.post<PrefectStateTransitionResponse>(`/flow_runs/${flowRunId}/set_state`, {
        state: { type: 'CANCELLING', message: 'Abort requested by a conservation task user.' },
        force: false
      });
      if (
        !['ACCEPT', 'REJECT'].includes(data.status) ||
        !data.state ||
        !['CANCELLING', 'CANCELLED'].includes(data.state.type)
      ) {
        throw new ApiGeneralError('Prefect did not accept the cancellation request.', []);
      }
    } catch (error) {
      defaultLog.error({ label: 'PrefectService.cancelFlowRun', error });
      throw new ApiGeneralError('Failed to cancel Prefect flow run', ['PrefectService.cancelFlowRun']);
    }
  }

  /**
   * Resolves a Prefect deployment ID by flow and deployment name.
   *
   * @param {string} flowName - Prefect flow name.
   * @param {string} deploymentName - Prefect deployment name.
   * @return {Promise<string>} Prefect deployment ID.
   * @throws {ApiGeneralError} Failed to resolve Prefect deployment ID.
   * @memberof PrefectService
   */
  async resolveDeploymentId(flowName: string, deploymentName: string): Promise<string> {
    try {
      const { data } = await this.axios.get<PrefectDeploymentResponse>(
        `/deployments/name/${encodeURIComponent(flowName)}/${encodeURIComponent(deploymentName)}`
      );

      return data.id;
    } catch (error) {
      defaultLog.error({ label: 'PrefectService.resolveDeploymentId', error });
      throw new ApiGeneralError('Failed to resolve Prefect deployment ID', ['PrefectService.resolveDeploymentId']);
    }
  }

  /**
   * Submits the run-scoped optimization pipeline. The workflow resolves all large inputs by run ID.
   *
   * @param {string} taskRunId Immutable task run ID.
   * @param {TaskType} taskType Scientific analysis type associated with the task.
   * @param {TaskRunExecutionMethod} executionMethod Execution method selected for the task run.
   * @param dispatchAttempt Attempt number used to distinguish workflow dispatches.
   * @returns {Promise<{ deploymentId: string; flowRunId: string }>} Identifiers of the selected Prefect deployment and submitted flow run.
   */
  async submitTaskRun(
    taskRunId: string,
    taskType: TaskType,
    executionMethod: TaskRunExecutionMethod,
    dispatchAttempt = 1
  ): Promise<{ deploymentId: string; flowRunId: string }> {
    const flowName = `task_run_${taskType}`;
    const deploymentName = `task-run-${taskType.replace(/_/g, '-')}-compiled`;
    const deploymentId = await this.resolveDeploymentId(flowName, deploymentName);
    const flowRunId = await this.submitFlowRunWithParameters(
      deploymentId,
      { task_run_id: taskRunId },
      `task-run:${taskType}:${executionMethod}:${taskRunId}:${dispatchAttempt}`
    );
    return { deploymentId, flowRunId };
  }

  /**
   * Dispatches presentation publication from a canonical task-run result.
   *
   * @param {string} taskRunId Identifier of the immutable task run.
   * @param {number} publicationRevision Publication revision used to identify this dispatch attempt.
   * @returns {Promise<{ deploymentId: string; flowRunId: string }>} Prefect deployment and flow-run identifiers for the publication attempt.
   */
  async submitTaskRunTile(
    taskRunId: string,
    publicationRevision: number
  ): Promise<{ deploymentId: string; flowRunId: string }> {
    const deploymentId = await this.resolveDeploymentId('task_tile', 'task-tile');
    const flowRunId = await this.submitFlowRunWithParameters(
      deploymentId,
      { task_run_id: taskRunId },
      `task-tile:${taskRunId}:${publicationRevision}`
    );
    return { deploymentId, flowRunId };
  }

  /**
   * Submits a task-run GeoTIFF export flow.
   *
   * @param {string} taskExportId Durable export job ID.
   * @param {number} attempt Export execution generation.
   * @returns {Promise<{ deploymentId: string; flowRunId: string }>} Identifiers of the selected Prefect deployment and submitted flow run.
   */
  async submitTaskExport(taskExportId: string, attempt: number): Promise<{ deploymentId: string; flowRunId: string }> {
    const deploymentId = await this.resolveDeploymentId('task_export', 'task-export');
    const flowRunId = await this.submitFlowRunWithParameters(
      deploymentId,
      { task_export_id: taskExportId, attempt },
      `task-export:${taskExportId}`
    );
    return { deploymentId, flowRunId };
  }

  /**
   * Submits a Prefect flow run with raw parameters.
   *
   * @param {string} deploymentId - Prefect deployment ID.
   * @param {Record<string, unknown>} parameters - Raw parameters for the run.
   * @param {string} idempotencyKey Optional key used to deduplicate repeated submissions.
   * @return {Promise<string>} Prefect flow run ID.
   * @throws {ApiGeneralError} Failed to submit Prefect flow run.
   * @memberof PrefectService
   */
  private async submitFlowRunWithParameters(
    deploymentId: string,
    parameters: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<string> {
    try {
      const { data } = await this.axios.post<PrefectFlowRunResponse>(`/deployments/${deploymentId}/create_flow_run`, {
        parameters,
        idempotency_key: idempotencyKey
      });

      return data.id;
    } catch (error) {
      defaultLog.error({ label: 'PrefectService.submitFlowRunWithParameters', error });
      throw new ApiGeneralError('Failed to submit Prefect flow run', ['PrefectService.submitFlowRunWithParameters']);
    }
  }

  private buildHeaders(): Record<string, string> | undefined {
    const apiKey = process.env.PREFECT_API_KEY;

    if (!apiKey) {
      return undefined;
    }

    return {
      Authorization: `Bearer ${apiKey}`
    };
  }
}

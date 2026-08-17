import axios, { AxiosInstance } from 'axios';
import { ApiGeneralError } from '../errors/api-error';
import { TaskType } from '../models/task';
import { TaskRunExecutionMethod } from '../models/task-run';
import { getLogger } from '../utils/logger';

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
   * Resolves a Prefect deployment ID by flow and deployment name.
   *
   * @param {string} flowName - Prefect flow name.
   * @param {string} deploymentName - Prefect deployment name.
   * @return {*} {Promise<string>} Prefect deployment ID.
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
   * @returns {Promise<{ deploymentId: string; flowRunId: string }>}
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

  /** Dispatches presentation publication from a canonical task-run result. */
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
   * Submits a Prefect flow run with raw parameters.
   *
   * @param {string} deploymentId - Prefect deployment ID.
   * @param {Record<string, unknown>} parameters - Raw parameters for the run.
   * @return {*} {Promise<string>} Prefect flow run ID.
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

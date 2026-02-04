import axios, { AxiosInstance } from 'axios';
import { ApiGeneralError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import type { OptimizationParameters } from './prefect-service.interface';

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
   * Submits a Prefect flow run for a deployment.
   *
   * @param {string} deploymentId - Prefect deployment ID.
   * @param {string} taskId - The task ID being executed.
   * @param {OptimizationParameters} parameters - Optimization parameters for the run.
   * @return {*} {Promise<string>} Prefect flow run ID.
   * @memberof PrefectService
   */
  async submitFlowRun(
    deploymentId: string,
    taskId: string,
    parameters: OptimizationParameters
  ): Promise<string> {
    return this.submitFlowRunWithParameters(deploymentId, { task_id: taskId, conditions: parameters });
  }

  /**
   * Submits a strict optimization flow run and returns flow/deployment IDs.
   *
   * @param {string} taskId - The task ID being executed.
   * @param {OptimizationParameters} parameters - Optimization parameters for the run.
   * @return {*} {Promise<{ deploymentId: string; flowRunId: string }>} IDs for tracking the run.
   * @memberof PrefectService
   */
  async submitStrictOptimization(
    taskId: string,
    parameters: OptimizationParameters
  ): Promise<{ deploymentId: string; flowRunId: string }> {
    const flowName = 'strict_optimization';
    const deploymentName = 'strict-optimization';

    const deploymentId = await this.resolveDeploymentId(flowName, deploymentName);
    const flowRunId = await this.submitFlowRun(deploymentId, taskId, parameters);

    return { deploymentId, flowRunId };
  }

  /**
   * Submits a task tile flow run and returns flow/deployment IDs.
   *
   * @param {string} taskId - The task ID being tiled.
   * @param {string} taskTileId - The task tile ID to update.
   * @return {*} {Promise<{ deploymentId: string; flowRunId: string }>} IDs for tracking the run.
   * @memberof PrefectService
   */
  async submitTaskTile(taskId: string, taskTileId: string): Promise<{ deploymentId: string; flowRunId: string }> {
    const flowName = 'task_tile';
    const deploymentName = 'task-tile';

    const deploymentId = await this.resolveDeploymentId(flowName, deploymentName);
    const flowRunId = await this.submitFlowRunWithParameters(deploymentId, {
      task_id: taskId,
      task_tile_id: taskTileId
    });

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
    parameters: Record<string, unknown>
  ): Promise<string> {
    try {
      const { data } = await this.axios.post<PrefectFlowRunResponse>(
        `/deployments/${deploymentId}/create_flow_run`,
        { parameters }
      );

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

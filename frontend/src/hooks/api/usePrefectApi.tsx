import config from 'config/config';
import useAxios from 'hooks/useAxios';
import { OptimizationParameters } from './usePrefectApi.interface';

/**
 * Provides Prefect API methods.
 *
 * @returns {*} - API methods for Prefect interactions
 */
export const usePrefectApi = () => {
  const axios = useAxios(config.PREFECT_API_HOST);

  /**
   * Submits a new flow run to a Prefect deployment by deployment ID.
   *
   *
   * @param {string} deploymentId - The ID of the Prefect deployment
   * @param {OptimizationParameters} conditions - Conditions for the flow run
   * @returns {Promise<any>} - Response data from the Prefect API
   */
  const submitOptimizationRun = async (deploymentId: string, conditions: OptimizationParameters): Promise<any> => {
    const { data } = await axios.post(
      `/deployments/${deploymentId}/create_flow_run`,
      // NOTE: Prefect requires the request body to be an object with 'parameters' like: { "parameters": {...request_body} }
      { parameters: { conditions } }
    );

    return data;
  };

  /**
   * Retrieves the deployment ID for a given flow and deployment name.
   *
   * @param {string} flowName - The name of the flow
   * @param {string} deploymentName - The name of the deployment
   * @returns {Promise<string>} - The deployment ID
   */
  const getDeploymentIdByName = async (flowName: string, deploymentName: string): Promise<string> => {
    const { data } = await axios.get<{ id: string }>(
      `/deployments/name/${encodeURIComponent(flowName)}/${encodeURIComponent(deploymentName)}`
    );

    return data.id;
  };

  /**
   * Submits a new flow run to a Prefect deployment by flow name and deployment name.
   *
   * @param {OptimizationParameters} parameters - Parameters for the flow run
   * @returns {Promise<any>} - Response data from the Prefect API
   */
  const submitStrictOptimizationRun = async (parameters: OptimizationParameters): Promise<any> => {
    const flowName = 'strict_optimization';
    const deploymentName = 'local';

    const deploymentId = await getDeploymentIdByName(flowName, deploymentName);

    return submitOptimizationRun(deploymentId, parameters);
  };

  return { submitStrictOptimizationRun };
};

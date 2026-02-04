import { AxiosInstance } from 'axios';
import { DashboardResponse } from 'hooks/interfaces/useDashboardApi.interface';

interface DashboardAccessResponse {
  access: 'PUBLIC';
}

/**
 * Returns API methods for dashboard management.
 *
 * @param {AxiosInstance} axios - Axios instance for making HTTP requests.
 * @return {*} Object containing dashboard API methods.
 */
export const useDashboardApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a dashboard by its ID.
   *
   * @param {string} dashboardId - The UUID of the dashboard to fetch.
   * @return {Promise<DashboardResponse>} The dashboard with task IDs.
   */
  const getDashboardById = async (dashboardId: string): Promise<DashboardResponse> => {
    const { data } = await axios.get<DashboardResponse>(`/api/dashboard/${dashboardId}`);
    return data;
  };

  /**
   * Check if a dashboard is publicly accessible.
   *
   * @param {string} dashboardId - The UUID of the dashboard to check.
   * @return {Promise<DashboardAccessResponse>} The access response.
   */
  const getDashboardAccess = async (dashboardId: string): Promise<DashboardAccessResponse> => {
    const { data } = await axios.get<DashboardAccessResponse>(`/api/dashboard/${dashboardId}/access`);
    return data;
  };

  return {
    getDashboardById,
    getDashboardAccess,
  };
};

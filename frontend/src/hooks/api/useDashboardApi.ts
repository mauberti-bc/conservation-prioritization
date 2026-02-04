import { AxiosInstance } from 'axios';
import { DashboardResponse } from 'hooks/interfaces/useDashboardApi.interface';

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

  return {
    getDashboardById,
  };
};

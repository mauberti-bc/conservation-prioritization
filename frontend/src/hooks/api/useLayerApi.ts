import { AxiosInstance } from 'axios';
import { FindLayersResponse } from 'hooks/interfaces/useLayerApi.interface';

/**
 * Returns a set of supported API methods for working with layers.
 *
 * @param {AxiosInstance} axios
 * @return {*} Object whose properties are supported API methods for layers.
 */
export const useLayersApi = (axios: AxiosInstance) => {
  /**
   * Find layers based on the search keyword.
   *
   * @param {string} keyword - The keyword to search for in layer names.
   * @return {Promise<FindLayersResponse>} A list of layers that match the search term.
   */
  const findLayers = async (keyword: string): Promise<FindLayersResponse> => {
    const { data } = await axios.get<FindLayersResponse>('/api/layers', {
      params: { keyword },
    });
    return data;
  };

  return {
    findLayers,
  };
};

import { AxiosInstance } from 'axios';
import { IProfile } from 'hooks/interfaces/useProfileApi.interface';

/**
 * Returns a set of supported API methods for working with profiles.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useProfileApi = (axios: AxiosInstance) => {
  /**
   * Get the currently authenticated user's profile.
   *
   * @return {Promise<IProfile>} The currently authenticated profile.
   */
  const getSelf = async (): Promise<IProfile> => {
    const { data } = await axios.get<IProfile>('/api/profile/self');
    return data;
  };

  return {
    getSelf,
  };
};

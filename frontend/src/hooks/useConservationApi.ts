import { useProfileApi } from './api/useProfileApi';
import { useProjectApi } from './api/useProjectApi';
import { useTaskApi } from './api/useTaskApi';
import useAxios from './useAxios';
import { useConfigContext } from './useContext';

/**
 * Returns a set of conservation-related API methods.
 *
 * @return {*} object containing task, profile, and project API methods.
 */
export const useConservationApi = () => {
  const config = useConfigContext();

  const apiAxios = useAxios(config?.API_HOST);

  const task = useTaskApi(apiAxios);
  const profile = useProfileApi(apiAxios);
  const project = useProjectApi(apiAxios);

  return {
    task,
    profile,
    project,
  };
};

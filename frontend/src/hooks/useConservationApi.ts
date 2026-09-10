import { useDashboardApi } from './api/useDashboardApi';
import { useLayersApi } from './api/useLayerApi';
import { useMarkdownApi } from './api/useMarkdownApi';
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

  const layer = useLayersApi(apiAxios);
  const markdown = useMarkdownApi(apiAxios);
  const dashboard = useDashboardApi(apiAxios);

  return {
    task,
    profile,
    project,
    layer,
    markdown,
    dashboard,
  };
};

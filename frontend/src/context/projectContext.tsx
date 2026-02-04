import { createContext, PropsWithChildren, useCallback, useMemo } from 'react';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';

export interface IProjectContext {
  projectsDataLoader: DataLoader<[], GetProjectResponse[], unknown>;
  refreshProjects: () => Promise<GetProjectResponse[] | undefined>;
}

export const ProjectContext = createContext<IProjectContext>({
  projectsDataLoader: {} as DataLoader<[], GetProjectResponse[], unknown>,
  refreshProjects: async () => undefined,
});

/**
 * Provides project data and refresh helpers.
 */
export const ProjectContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const projectsDataLoader = useDataLoader(conservationApi.project.getAllProjects);

  const refreshProjects = useCallback(async () => {
    return projectsDataLoader.refresh();
  }, [projectsDataLoader]);

  const contextValue = useMemo(() => {
    return {
      projectsDataLoader,
      refreshProjects,
    };
  }, [projectsDataLoader, refreshProjects]);

  return <ProjectContext.Provider value={contextValue}>{props.children}</ProjectContext.Provider>;
};

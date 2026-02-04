import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { createContext, PropsWithChildren, useCallback, useEffect, useMemo } from 'react';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { useSearchParams } from 'hooks/useSearchParams';

export interface ITaskContext {
  taskDataLoader: DataLoader<[task_id: string], GetTaskResponse, unknown>;
  tasksDataLoader: DataLoader<[], GetTaskResponse[], unknown>;
  taskId: string | null; // Allow taskId to be null
  setFocusedTask: (task: GetTaskResponse | null) => void;
  refreshTasks: () => Promise<GetTaskResponse[] | undefined>;
}

export const TaskContext = createContext<ITaskContext>({
  taskDataLoader: {} as DataLoader<[task_id: string], GetTaskResponse, unknown>,
  tasksDataLoader: {} as DataLoader<[], GetTaskResponse[], unknown>,
  taskId: null, // Set default to null
  setFocusedTask: () => undefined,
  refreshTasks: async () => undefined,
});

export const TaskContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
  const activeTaskId = searchParams.get(QUERY_PARAM.TASK_ID);

  useEffect(() => {
    if (activeTaskId && taskDataLoader.data?.task_id !== activeTaskId) {
      taskDataLoader.load(activeTaskId);
    }
  }, [activeTaskId, taskDataLoader]);

  const setFocusedTask = useCallback(
    (task: GetTaskResponse | null) => {
      if (task) {
        searchParams.set(QUERY_PARAM.TASK_ID, task.task_id);
        setSearchParams(searchParams);
        taskDataLoader.setData(task);
      } else {
        searchParams.delete(QUERY_PARAM.TASK_ID);
        setSearchParams(searchParams);
        taskDataLoader.clearData();
      }
    },
    [searchParams, setSearchParams, taskDataLoader]
  );

  const refreshTasks = useCallback(async () => {
    return tasksDataLoader.refresh();
  }, [tasksDataLoader]);

  const taskContext: ITaskContext = useMemo(() => {
    return {
      taskDataLoader,
      tasksDataLoader,
      taskId: activeTaskId || null,
      setFocusedTask,
      refreshTasks,
    };
  }, [activeTaskId, refreshTasks, setFocusedTask, taskDataLoader, tasksDataLoader]);

  return <TaskContext.Provider value={taskContext}>{props.children}</TaskContext.Provider>;
};

import { GetTaskResponse, GetTasksResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';

export interface ITaskContext {
  taskDataLoader: DataLoader<[task_id: string], GetTaskResponse, unknown>;
  tasksDataLoader: DataLoader<[pagination?: ApiPaginationRequestOptions], GetTasksResponse, unknown>;
  taskId: string;
  setFocusedTask: (task: GetTaskResponse | null) => void;
  refreshTasks: () => Promise<GetTasksResponse | undefined>;
  hoveredTilesetUri: string | null;
  setHoveredTilesetUri: (uri: string | null) => void;
}

export const TaskContext = createContext<ITaskContext>({
  taskDataLoader: {} as DataLoader<[task_id: string], GetTaskResponse, unknown>,
  tasksDataLoader: {} as DataLoader<[pagination?: ApiPaginationRequestOptions], GetTasksResponse, unknown>,
  taskId: '',
  setFocusedTask: () => undefined,
  refreshTasks: async () => undefined,
  hoveredTilesetUri: null,
  setHoveredTilesetUri: () => undefined,
});

export const TaskContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const navigate = useNavigate();
  const { taskId: activeTaskId } = useParams<{ taskId: string }>();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const lastRequestedTaskIdRef = useRef<string | null>(null);
  const [hoveredTilesetUri, setHoveredTilesetUri] = useState<string | null>(null);
  const defaultPagination = useMemo<ApiPaginationRequestOptions>(() => {
    return {
      page: 1,
      limit: 25,
      sort: 'created_at',
      order: 'desc',
    };
  }, []);

  if (!activeTaskId) {
    throw new Error('TaskContextProvider requires a :taskId route parameter.');
  }

  useEffect(() => {
    if (taskDataLoader.isLoading) {
      return;
    }

    const hasRequestedRouteTask = lastRequestedTaskIdRef.current === activeTaskId;
    const hasMismatchedLoadedTask = taskDataLoader.data?.task_id !== activeTaskId;
    if (hasRequestedRouteTask && !hasMismatchedLoadedTask) {
      return;
    }

    lastRequestedTaskIdRef.current = activeTaskId;
    void taskDataLoader.refresh(activeTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, taskDataLoader.data?.task_id, taskDataLoader.isLoading]);

  const setFocusedTask = useCallback(
    (task: GetTaskResponse | null) => {
      setHoveredTilesetUri(null);
      if (task) {
        navigate(`/t/${task.task_id}`);
        taskDataLoader.setData(task);
      } else {
        navigate('/t/');
        taskDataLoader.clearData();
      }
    },
    [navigate, setHoveredTilesetUri, taskDataLoader]
  );

  const refreshTasks = useCallback(async () => {
    return tasksDataLoader.refresh(defaultPagination);
  }, [defaultPagination, tasksDataLoader]);

  const taskContext: ITaskContext = useMemo(() => {
    return {
      taskDataLoader,
      tasksDataLoader,
      taskId: activeTaskId,
      setFocusedTask,
      refreshTasks,
      hoveredTilesetUri,
      setHoveredTilesetUri,
    };
  }, [activeTaskId, refreshTasks, setFocusedTask, taskDataLoader, tasksDataLoader, hoveredTilesetUri]);

  return <TaskContext.Provider value={taskContext}>{props.children}</TaskContext.Provider>;
};

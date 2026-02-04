import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { createContext, PropsWithChildren, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ITaskContext {
  taskDataLoader: DataLoader<[task_id: string], GetTaskResponse, unknown>;
  taskId: string | null; // Allow taskId to be null
}

export const TaskContext = createContext<ITaskContext>({
  taskDataLoader: {} as DataLoader<[task_id: string], GetTaskResponse, unknown>,
  taskId: null, // Set default to null
});

export const TaskContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);

  const { taskId } = useParams<{ taskId?: string }>();

  useEffect(() => {
    if (taskId) {
      taskDataLoader.load(taskId);
    }
  }, [taskId, taskDataLoader]);

  const taskContext: ITaskContext = useMemo(() => {
    return {
      taskDataLoader,
      taskId: taskId || null,
    };
  }, [taskDataLoader, taskId]);

  return <TaskContext.Provider value={taskContext}>{props.children}</TaskContext.Provider>;
};

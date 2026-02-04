import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

export interface ITaskContext {
  taskDataLoader: DataLoader<[task_id: string], GetTaskResponse, unknown>;
  taskId: string | null; // Allow taskId to be null
  setFocusedTask: (task: GetTaskResponse | null) => void;
}

export const TaskContext = createContext<ITaskContext>({
  taskDataLoader: {} as DataLoader<[task_id: string], GetTaskResponse, unknown>,
  taskId: null, // Set default to null
  setFocusedTask: () => undefined,
});

export const TaskContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const { taskId } = useParams<{ taskId?: string }>();
  const activeTaskId = taskId ?? focusedTaskId;

  useEffect(() => {
    if (activeTaskId && taskDataLoader.data?.task_id !== activeTaskId) {
      taskDataLoader.load(activeTaskId);
    }
  }, [activeTaskId, taskDataLoader]);

  const setFocusedTask = useCallback(
    (task: GetTaskResponse | null) => {
      if (task) {
        setFocusedTaskId(task.task_id);
        taskDataLoader.setData(task);
      } else {
        setFocusedTaskId(null);
        taskDataLoader.clearData();
      }
    },
    [taskDataLoader]
  );

  const taskContext: ITaskContext = useMemo(() => {
    return {
      taskDataLoader,
      taskId: activeTaskId || null,
      setFocusedTask,
    };
  }, [activeTaskId, setFocusedTask, taskDataLoader]);

  return <TaskContext.Provider value={taskContext}>{props.children}</TaskContext.Provider>;
};

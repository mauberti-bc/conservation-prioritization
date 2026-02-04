import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { createContext, PropsWithChildren, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

/**
 * Context object that stores information about a task
 *
 * @export
 * @interface ITaskContext
 */
export interface ITaskContext {
  /**
   * The Data Loader used to load task data
   *
   * @type {DataLoader<[task_id: string], GetTaskResponse, unknown>}
   * @memberof ITaskContext
   */
  taskDataLoader: DataLoader<[task_id: string], GetTaskResponse, unknown>;

  /**
   * The task ID belonging to the current task
   *
   * @type {string}
   * @memberof ITaskContext
   */
  taskId: string;
}

export const TaskContext = createContext<ITaskContext>({
  taskDataLoader: {} as DataLoader<[task_id: string], GetTaskResponse, unknown>,
  taskId: '',
});

export const TaskContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const conservationApi = useConservationApi();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);

  const urlParams: Record<string, string | undefined> = useParams();

  if (!urlParams['taskId']) {
    throw new Error(
      "The task ID found in TaskContextProvider was invalid. Does your current React route provide a 'taskId' parameter?"
    );
  }

  const taskId = useMemo(() => urlParams['taskId'] as string, [urlParams['taskId']]);

  useEffect(() => {
    (taskDataLoader.load(taskId), [taskDataLoader]);
  });

  /**
   * Refreshes the current task object whenever the current task ID changes from the currently loaded task.
   */
  useEffect(() => {
    if (taskId && taskId !== taskDataLoader.data?.task_id) {
      taskDataLoader.refresh(taskId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const taskContext: ITaskContext = useMemo(() => {
    return {
      taskDataLoader,
      taskId,
    };
  }, [taskDataLoader, taskId]);

  return <TaskContext.Provider value={taskContext}>{props.children}</TaskContext.Provider>;
};

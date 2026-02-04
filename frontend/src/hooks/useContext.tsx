import { AuthContext } from 'context/authContext';
import { ConfigContext, IConfig } from 'context/configContext';
import { DialogContext, IDialogContext } from 'context/dialogContext';
import { MapContext } from 'context/mapContext';
import { ITaskContext, TaskContext } from 'context/taskContext';
import { useContext } from 'react';

/**
 * Returns an instance of `IDialogContext` from `DialogContext`.
 *
 * @return {*}  {IDialogContext}
 */
export const useDialogContext = (): IDialogContext => {
  const context = useContext(DialogContext);

  if (!context) {
    throw Error(
      'DialogContext is undefined, please verify you are calling useDialogContext() as child of an <DialogContextProvider> component.'
    );
  }

  return context;
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within a AuthProvider');
  }
  return context;
};

/**
 * Returns an instance of `IConfig` from `ConfigContext`.
 *
 * @return {*}  {IConfig}
 */
export const useConfigContext = (): IConfig => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw Error(
      'ConfigContext is undefined, please verify you are calling useConfigContext() as child of an <ConfigContextProvider> component.'
    );
  }

  return context;
};

/**
 * Returns an instance of `ITask` from `TaskContext`.
 *
 * @return {*}  {ITask}
 */
export const useTaskContext = (): ITaskContext => {
  const context = useContext(TaskContext);

  if (!context) {
    throw Error(
      'TaskContext is undefined, please verify you are calling useTaskContext() as child of an <TaskContextProvider> component.'
    );
  }

  return context;
};

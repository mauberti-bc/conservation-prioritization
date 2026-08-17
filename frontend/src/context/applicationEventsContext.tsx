import useWebsocket from 'hooks/useWebsocket';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './authContext';
import { ConfigContext } from './configContext';

interface TaskRunChangedEvent {
  type: 'task_run.updated';
  task_run_id: string;
  task_id: string;
  revision: number;
}

export interface IApplicationEventsContext {
  taskRevisions: Record<string, number>;
  connectionEpoch: number;
  unseenTaskIds: ReadonlySet<string>;
  markTaskSeen: (taskId: string) => void;
}

export const ApplicationEventsContext = createContext<IApplicationEventsContext | undefined>(undefined);

/** Maintains the single authenticated application-scoped realtime connection. */
export const ApplicationEventsContextProvider = (props: PropsWithChildren) => {
  const auth = useContext(AuthContext);
  const config = useContext(ConfigContext);
  if (!auth || !config) {
    throw new Error('ApplicationEventsContextProvider requires authentication and configuration contexts.');
  }
  const { API_HOST } = config;
  const websocket = useWebsocket(API_HOST);
  const knownRevisionsRef = useRef<Record<string, number>>({});
  const [taskRevisions, setTaskRevisions] = useState<Record<string, number>>({});
  const [unseenTaskIds, setUnseenTaskIds] = useState<ReadonlySet<string>>(new Set());
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  useEffect(() => {
    if (!auth.auth.isAuthenticated || !auth.auth.user?.access_token) {
      return undefined;
    }

    const subscription = websocket.subscribe('/api/events', undefined, {
      onOpen: () => {
        setConnectionEpoch((current) => current + 1);
      },
      onMessage: (event) => {
        try {
          const change = JSON.parse(event.data) as TaskRunChangedEvent;
          const next = { ...knownRevisionsRef.current };
          const previous = knownRevisionsRef.current[change.task_id];
          if (previous === undefined || change.revision > previous) {
            next[change.task_id] = change.revision;
            knownRevisionsRef.current = next;
            setTaskRevisions(next);
            setUnseenTaskIds((current) => new Set([...current, change.task_id]));
          }
        } catch (error) {
          console.error('Failed to parse application event notification', error);
        }
      },
    });
    return subscription.stop;
  }, [auth.auth.isAuthenticated, auth.auth.user?.access_token, websocket]);

  const markTaskSeen = useCallback((taskId: string) => {
    setUnseenTaskIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ taskRevisions, connectionEpoch, unseenTaskIds, markTaskSeen }),
    [connectionEpoch, markTaskSeen, taskRevisions, unseenTaskIds]
  );
  return <ApplicationEventsContext.Provider value={value}>{props.children}</ApplicationEventsContext.Provider>;
};

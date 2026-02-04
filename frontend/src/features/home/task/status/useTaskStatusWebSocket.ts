import { TASK_STATUS, TaskStatusValue } from 'constants/status';
import { useConfigContext } from 'hooks/useContext';
import useWebsocket from 'hooks/useWebsocket';
import { useEffect, useRef, useState } from 'react';
import { TaskStatusMessage } from './task-status.interface';

export interface UseTaskStatusWebSocketReturn {
  data: TaskStatusMessage | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Subscribes to task status updates via websocket.
 *
 * @param {string | null} taskId
 * @return {*}  {UseTaskStatusWebSocketReturn}
 */
export const useTaskStatusWebSocket = (taskId: string | null): UseTaskStatusWebSocketReturn => {
  const { API_HOST } = useConfigContext();
  const websocket = useWebsocket(API_HOST);
  const [data, setData] = useState<TaskStatusMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTerminalRef = useRef(false);

  useEffect(() => {
    if (!taskId) {
      setData(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    setData(null);
    setError(null);
    isTerminalRef.current = false;
    let stopSubscription: (() => void) | null = null;

    const subscription = websocket.subscribe(`/api/task/${taskId}/status`, undefined, {
      onOpen: () => {
        setIsConnected(true);
      },
      onMessage: (event) => {
        try {
          const parsed = JSON.parse(event.data) as TaskStatusMessage;
          setData(parsed);

          const terminalStatuses: TaskStatusValue[] = [
            TASK_STATUS.COMPLETED,
            TASK_STATUS.FAILED,
            TASK_STATUS.FAILED_TO_SUBMIT,
          ];

          if (parsed.status && terminalStatuses.includes(parsed.status)) {
            isTerminalRef.current = true;
            setIsConnected(false);
            stopSubscription?.();
          }
        } catch (parseError) {
          console.error('Failed to parse task status message', parseError);
        }
      },
      onError: () => {
        setError('Task status connection error.');
      },
      onClose: () => {
        if (isTerminalRef.current) {
          setIsConnected(false);
          return;
        }

        setIsConnected(false);
      },
    });
    stopSubscription = subscription.stop;

    return () => {
      if (stopSubscription) {
        stopSubscription();
        stopSubscription = null;
      }
    };
  }, [taskId, websocket]);

  return { data, isConnected, error };
};

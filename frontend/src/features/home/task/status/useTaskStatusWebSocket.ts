import { useConfigContext } from 'hooks/useContext';
import useWebsocket from 'hooks/useWebsocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TASK_STATUS } from 'constants/status';
import { TaskStatusMessage } from './task-status.interface';

export interface UseTaskStatusWebSocketReturn {
  data: TaskStatusMessage | null;
  isConnected: boolean;
  error: string | null;
  stop: () => void;
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
  const stopSubscriptionRef = useRef<(() => void) | null>(null);
  const isTerminalRef = useRef(false);

  /**
   * Stops the active websocket subscription.
   *
   * @returns {void}
   */
  const stop = useCallback(() => {
    if (stopSubscriptionRef.current) {
      stopSubscriptionRef.current();
      stopSubscriptionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!taskId) {
      stop();
      setData(null);
      setError(null);
      isTerminalRef.current = false;
      return;
    }

    setData(null);
    setError(null);
    isTerminalRef.current = false;
    stop();

    const subscription = websocket.subscribe(`/api/task/${taskId}/status`, undefined, {
      onOpen: () => {
        setIsConnected(true);
      },
      onMessage: (event) => {
        try {
          const parsed = JSON.parse(event.data) as TaskStatusMessage;
          setData(parsed);
          const hasPmtilesUri = Boolean(parsed.tile?.pmtiles_uri ?? parsed.tileset_uri);
          const isFailedTerminal =
            parsed.status === TASK_STATUS.FAILED || parsed.status === TASK_STATUS.FAILED_TO_SUBMIT;
          const isCompletedWithTileset = parsed.status === TASK_STATUS.COMPLETED && hasPmtilesUri;
          if (isFailedTerminal || isCompletedWithTileset) {
            isTerminalRef.current = true;
          }
        } catch (parseError) {
          console.error('Failed to parse task status message', parseError);
        }
      },
      onError: () => {
        setError('Task status connection error.');
      },
      onClose: () => {
        setIsConnected(false);
      },
      shouldReconnect: () => {
        return !isTerminalRef.current;
      },
    });
    stopSubscriptionRef.current = subscription.stop;

    return () => {
      stop();
    };
  }, [taskId, stop, websocket]);

  return { data, isConnected, error, stop };
};

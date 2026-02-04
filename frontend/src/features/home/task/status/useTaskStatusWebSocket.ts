import { useConfigContext } from 'hooks/useContext';
import { useEffect, useRef, useState } from 'react';
import { buildWebSocketUrl } from 'utils/websocket';
import { TASK_STATUS } from 'constants/status';
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
  const [data, setData] = useState<TaskStatusMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const latestStatusRef = useRef<string | null>(null);

  const closeSocket = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  useEffect(() => {
    if (!taskId) {
      closeSocket();
      setData(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    const wsUrl = buildWebSocketUrl(API_HOST, `/api/task/${taskId}/status`);

    const connect = async () => {
      closeSocket();
      setError(null);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as TaskStatusMessage;
          setData(parsed);
          latestStatusRef.current = parsed.status ?? null;
        } catch (parseError) {
          console.error('Failed to parse task status message', parseError);
        }
      };

      socket.onerror = () => {
        setError('Task status connection error.');
      };

      socket.onclose = () => {
        setIsConnected(false);
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (!taskId) {
        return;
      }

      if (
        latestStatusRef.current &&
        [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.FAILED_TO_SUBMIT].includes(latestStatusRef.current)
      ) {
        return;
      }

      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectAttemptRef.current += 1;
      const delayMs = Math.min(1000 * reconnectAttemptRef.current, 10000);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        void connect();
      }, delayMs);
    };

    void connect();

    return () => {
      closeSocket();
    };
  }, [API_HOST, taskId]);

  return { data, isConnected, error };
};

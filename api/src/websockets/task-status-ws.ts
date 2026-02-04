import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { getAPIUserDBConnection } from '../database/db';
import { TaskService } from '../services/task-service';
import type { TaskStatusMessage } from '../types/task-status';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger(__filename);

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'failed_to_submit']);

/**
 * Creates a WebSocket server instance for task status updates.
 *
 * @return {*}  {WebSocketServer}
 */
export const createTaskStatusWebSocketServer = (): WebSocketServer => {
  return new WebSocketServer({ noServer: true });
};

/**
 * Parses a task status path for extracting task ID.
 *
 * @param {string} pathname
 * @return {*}  {string | null}
 */
export const parseTaskStatusPath = (pathname: string): string | null => {
  const match = /^\/api\/task\/([^/]+)\/status$/.exec(pathname) || /^\/task\/([^/]+)\/status$/.exec(pathname);
  return match ? match[1] : null;
};

/**
 * Handles an upgraded WebSocket connection for task status updates.
 *
 * @param {WebSocket} ws
 * @param {IncomingMessage} req
 * @param {string} taskId
 * @return {*}  {void}
 */
export const handleTaskStatusConnection = (ws: WebSocket, req: IncomingMessage, taskId: string): void => {
  defaultLog.debug({
    label: 'task-status-ws',
    message: `Connected to task ${taskId}`,
    remoteAddress: req.socket.remoteAddress
  });

  let lastSnapshot: string | null = null;
  let isClosed = false;
  let pollInterval: NodeJS.Timeout | null = null;

  const pollStatus = async () => {
    if (isClosed) {
      return;
    }

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();
      const taskService = new TaskService(connection);
      const snapshot = await taskService.getTaskStatusSnapshot(taskId);
      await connection.commit();

      lastSnapshot = await sendIfChanged(ws, snapshot, lastSnapshot);

      if (TERMINAL_STATUSES.has(snapshot.status)) {
        ws.close();
      }
    } catch (error) {
      defaultLog.error({ label: 'task-status-ws', message: 'poll error', error });
      ws.close();
    } finally {
      connection.release();
    }
  };

  ws.on('close', () => {
    isClosed = true;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  pollInterval = setInterval(() => {
    void pollStatus();
  }, 1500);

  void pollStatus();
};

async function sendIfChanged(
  ws: WebSocket,
  snapshot: TaskStatusMessage,
  lastSnapshot: string | null
): Promise<string | null> {
  const payload = JSON.stringify(snapshot);

  if (ws.readyState !== WebSocket.OPEN) {
    return lastSnapshot;
  }

  if (payload === lastSnapshot) {
    return lastSnapshot;
  }

  ws.send(payload);
  return payload;
}

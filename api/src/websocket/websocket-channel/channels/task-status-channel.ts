import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { getAPIUserDBConnection } from '../../../database/db';
import { TaskService } from '../../../services/task-service';
import { TASK_STATUS } from '../../../types/status';
import { TaskStatusMessage } from '../../../types/task-status';
import { getLogger } from '../../../utils/logger';
import { startPollingWebsocketChannel } from '../polling-websocket-channel';

const defaultLog = getLogger('websocket/task-status-channel');

export interface TaskStatusChannelParams {
  taskId: string;
}

const TERMINAL_STATUSES = new Set([TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.FAILED_TO_SUBMIT]);

/**
 * Matches websocket upgrade requests for task status updates.
 *
 * @param {IncomingMessage} req
 * @return {*}  {TaskStatusChannelParams | null}
 */
export const matchTaskStatusChannel = (req: IncomingMessage): TaskStatusChannelParams | null => {
  const url = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
  const match = /^\/api\/task\/([^/]+)\/status$/.exec(url.pathname) || /^\/task\/([^/]+)\/status$/.exec(url.pathname);

  if (!match) {
    return null;
  }

  return { taskId: match[1] };
};

/**
 * Handles a websocket connection for task status updates.
 *
 * @param {WebSocket} ws
 * @param {IncomingMessage} req
 * @param {TaskStatusChannelParams} params
 */
export const handleTaskStatusChannel = async (
  ws: WebSocket,
  req: IncomingMessage,
  params: TaskStatusChannelParams
): Promise<void> => {
  defaultLog.debug({
    label: 'task-status-channel',
    message: `Connected to task ${params.taskId}`,
    remoteAddress: req.socket.remoteAddress
  });

  await startPollingWebsocketChannel<TaskStatusMessage>({
    ws,
    req,
    label: 'task-status-channel',
    fetchPayload: async () => {
      const connection = getAPIUserDBConnection();

      try {
        await connection.openWithoutTransaction();
        const taskService = new TaskService(connection);
        return await taskService.getTaskStatusSnapshot(params.taskId);
      } finally {
        connection.release();
      }
    },
    shouldClose: (payload) => {
      return TERMINAL_STATUSES.has(payload.status);
    }
  });
};

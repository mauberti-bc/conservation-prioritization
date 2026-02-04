import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import { handleTaskStatusChannel, matchTaskStatusChannel } from './websocket-channel/channels/task-status-channel';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('websocket/ws-server');

export interface WebSocketRoute<TParams> {
  name: string;
  match: (req: IncomingMessage) => TParams | null;
  handle: (ws: WebSocket, req: IncomingMessage, params: TParams) => Promise<void>;
}

const routes: WebSocketRoute<any>[] = [
  {
    name: 'task-status',
    match: matchTaskStatusChannel,
    handle: handleTaskStatusChannel
  }
];

export const webSocketServer = new WebSocketServer({ noServer: true });

/**
 * Handles HTTP upgrade requests and dispatches to registered websocket routes.
 *
 * @param {IncomingMessage} req
 * @param {Socket} socket
 * @param {Buffer} head
 */
export const handleWebSocketUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
  const matchedRoute = routes
    .map((route) => ({ route, params: route.match(req) }))
    .find((entry) => entry.params !== null);

  if (!matchedRoute || !matchedRoute.params) {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(req, socket, head, (ws) => {
    defaultLog.debug({ label: 'websocket-upgrade', route: matchedRoute.route.name });
    void matchedRoute.route.handle(ws, req, matchedRoute.params);
  });
};

import { Request } from 'express';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { authenticateRequest } from '../request-handlers/security/authentication';
import { getLogger } from '../utils/logger';
import {
  handleApplicationEventsChannel,
  matchApplicationEventsChannel
} from './websocket-channel/channels/application-events-channel';

const defaultLog = getLogger('websocket/ws-server');

export interface WebSocketRoute<TParams> {
  name: string;
  match: (req: IncomingMessage) => TParams | null;
  handle: (ws: WebSocket, req: IncomingMessage, params: TParams) => Promise<void>;
}

const routes: WebSocketRoute<any>[] = [
  {
    name: 'application-events',
    match: matchApplicationEventsChannel,
    handle: handleApplicationEventsChannel
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
export const handleWebSocketUpgrade = async (req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
  // `server.on('upgrade')` provides a Duplex, but ws expects a net.Socket.
  const netSocket = socket as unknown as Socket;
  const matchedRoute = routes
    .map((route) => ({ route, params: route.match(req) }))
    .find((entry) => entry.params !== null);

  if (!matchedRoute || !matchedRoute.params) {
    netSocket.destroy();
    return;
  }

  const protocols = String(req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((value) => value.trim());
  const bearerProtocol = protocols.find((value) => value.startsWith('bearer.'));
  if (!bearerProtocol) {
    netSocket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    netSocket.destroy();
    return;
  }

  req.headers.authorization = `Bearer ${bearerProtocol.slice('bearer.'.length)}`;
  try {
    await authenticateRequest(req as unknown as Request);
  } catch (error) {
    defaultLog.warn({ label: 'websocket-upgrade', message: 'Authentication failed', error });
    netSocket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    netSocket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(req, netSocket, head, (ws) => {
    defaultLog.debug({ label: 'websocket-upgrade', route: matchedRoute.route.name });
    void matchedRoute.route.handle(ws, req, matchedRoute.params);
  });
};

import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('websocket/polling-channel');

export interface PollingWebsocketChannelOptions<TPayload> {
  ws: WebSocket;
  req: IncomingMessage;
  label: string;
  pollIntervalMs?: number;
  pingIntervalMs?: number;
  fetchPayload: () => Promise<TPayload>;
  shouldClose?: (payload: TPayload) => boolean;
  getFingerprint?: (payload: TPayload) => string;
  isNonFatalError?: (error: unknown) => boolean;
}

/**
 * Starts a polling websocket channel that emits payloads only when they change.
 *
 * @template TPayload
 * @param {PollingWebsocketChannelOptions<TPayload>} options
 */
export const startPollingWebsocketChannel = async <TPayload>(
  options: PollingWebsocketChannelOptions<TPayload>
): Promise<void> => {
  const {
    ws,
    req,
    label,
    pollIntervalMs = 1500,
    pingIntervalMs = 15000,
    fetchPayload,
    shouldClose,
    getFingerprint,
    isNonFatalError
  } = options;

  let lastFingerprint: string | null = null;
  let pollInterval: NodeJS.Timeout | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const safeSend = (payload: string) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(payload);
  };

  const closeSocket = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };

  const cleanup = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  const pollOnce = async () => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = await fetchPayload();
      const payloadString = JSON.stringify(payload);
      const fingerprint = getFingerprint ? getFingerprint(payload) : payloadString;

      if (fingerprint !== lastFingerprint) {
        safeSend(payloadString);
        lastFingerprint = fingerprint;
      }

      if (shouldClose && shouldClose(payload)) {
        closeSocket();
      }
    } catch (error) {
      if (isNonFatalError && isNonFatalError(error)) {
        defaultLog.warn({
          label,
          message: 'poll warning',
          error,
          remoteAddress: req.socket.remoteAddress
        });
        return;
      }

      defaultLog.error({ label, message: 'poll error', error, remoteAddress: req.socket.remoteAddress });
      closeSocket();
    }
  };

  ws.on('close', () => {
    cleanup();
  });

  pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, pingIntervalMs);

  pollInterval = setInterval(() => {
    void pollOnce();
  }, pollIntervalMs);

  await pollOnce();

  await new Promise<void>((resolve) => {
    ws.on('close', () => {
      resolve();
    });
  });
};

import pg from 'pg';
import { WebSocket } from 'ws';
import { getDBPool } from '../database/db';
import { getLogger } from '../utils/logger';

const log = getLogger('websocket/realtime-event-service');
const CHANNEL = 'conservation_realtime';
const MAX_BUFFERED_BYTES = 1024 * 1024;
const HEARTBEAT_INTERVAL_MS = 30000;

export interface TaskChangedEvent {
  type: 'task.updated';
  task_id: string;
  status: string;
  updated_at?: string;
}

interface TaskRunChangedEvent {
  type: 'task_run.updated';
  task_id: string;
  task_run_id: string;
  revision: number;
}

interface ProfileScopeChangedEvent {
  type: 'profile_scope.updated';
  profile_id: string;
}

interface RealtimeSocket extends WebSocket {
  isAlive?: boolean;
}

interface ProfileConnections {
  sockets: Set<RealtimeSocket>;
  visibleTaskIds: Set<string>;
}

const connectionsByProfile = new Map<string, ProfileConnections>();
let listenerClient: pg.PoolClient | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

/** Registers one local socket against its profile-visible task scope. */
export function registerRealtimeSocket(
  socket: RealtimeSocket,
  profileId: string,
  visibleTaskIds: Set<string>
): () => void {
  const profile = connectionsByProfile.get(profileId) ?? {
    sockets: new Set<RealtimeSocket>(),
    visibleTaskIds
  };
  profile.visibleTaskIds = visibleTaskIds;
  profile.sockets.add(socket);
  connectionsByProfile.set(profileId, profile);
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  const unregister = () => {
    const current = connectionsByProfile.get(profileId);
    current?.sockets.delete(socket);
    if (current && current.sockets.size === 0) {
      connectionsByProfile.delete(profileId);
    }
  };
  socket.once('close', unregister);
  return unregister;
}

/** Starts one PostgreSQL LISTEN connection for this API replica. */
export async function initRealtimeEventService(): Promise<void> {
  if (listenerClient) {
    return;
  }
  listenerClient = await getDBPool().connect();
  listenerClient.on('notification', handleNotification);
  listenerClient.on('error', handleListenerError);
  await listenerClient.query(`LISTEN ${CHANNEL}`);
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(heartbeatSockets, HEARTBEAT_INTERVAL_MS);
  }
  log.info({ label: 'realtime-listener', message: `Listening on ${CHANNEL}` });
}

/** Stops the replica listener and heartbeat, primarily for controlled shutdown/tests. */
export async function stopRealtimeEventService(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  const client = listenerClient;
  listenerClient = null;
  if (client) {
    client.removeListener('notification', handleNotification);
    client.removeListener('error', handleListenerError);
    await client.query(`UNLISTEN ${CHANNEL}`);
    client.release();
  }
}

function handleNotification(message: pg.Notification): void {
  if (message.channel !== CHANNEL || !message.payload) {
    return;
  }
  try {
    const event = JSON.parse(message.payload) as TaskChangedEvent | TaskRunChangedEvent | ProfileScopeChangedEvent;
    if (event.type === 'profile_scope.updated' && typeof event.profile_id === 'string') {
      reconnectProfileSockets(event.profile_id);
      return;
    }

    if (event.type === 'task_run.updated') {
      return;
    }

    if (event.type !== 'task.updated' || typeof event.task_id !== 'string' || typeof event.status !== 'string') {
      throw new Error('Invalid realtime event envelope.');
    }
    forwardRealtimeEvent(event);
  } catch (error) {
    log.error({ label: 'realtime-notification', message: 'Invalid notification payload', error });
  }
}

function reconnectProfileSockets(profileId: string): void {
  const profile = connectionsByProfile.get(profileId);
  if (!profile) {
    return;
  }
  for (const socket of profile.sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1012, 'Authorization scope changed');
    }
  }
}

/** Forwards a committed event only to authorized sockets on this replica. */
export function forwardRealtimeEvent(event: TaskChangedEvent): void {
  const payload = JSON.stringify(event);
  for (const profile of connectionsByProfile.values()) {
    if (!profile.visibleTaskIds.has(event.task_id)) {
      continue;
    }
    for (const socket of profile.sockets) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        socket.close(1013, 'Client is not consuming realtime events');
        continue;
      }
      socket.send(payload);
    }
  }
}

function heartbeatSockets(): void {
  for (const profile of connectionsByProfile.values()) {
    for (const socket of profile.sockets) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }
}

function handleListenerError(error: Error): void {
  log.error({ label: 'realtime-listener', message: 'PostgreSQL listener disconnected', error });
  listenerClient?.release(true);
  listenerClient = null;
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void initRealtimeEventService().catch((reconnectError) => {
        handleListenerError(reconnectError as Error);
      });
    }, 1000);
  }
}

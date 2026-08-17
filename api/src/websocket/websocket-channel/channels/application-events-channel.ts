import { Request } from 'express';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { getDBConnection } from '../../../database/db';
import { TaskRepository } from '../../../repositories/task-repository';
import { registerRealtimeSocket } from '../../realtime-event-service';

/** Matches the single authenticated application event channel. */
export function matchApplicationEventsChannel(req: IncomingMessage): Record<string, never> | null {
  const url = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
  return /^\/api\/events\/?$/.test(url.pathname) ? {} : null;
}

/** Registers the socket once against the authenticated profile's visible tasks. */
export async function handleApplicationEventsChannel(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const connection = getDBConnection((req as unknown as Request).keycloak_token);
  try {
    await connection.openWithoutTransaction();
    const profileId = connection.profileId();
    const tasks = await new TaskRepository(connection).getTasksByProfileId(profileId);
    registerRealtimeSocket(ws, profileId, new Set(tasks.map((task) => task.task_id)));
  } finally {
    connection.release();
  }

  await new Promise<void>((resolve) => {
    ws.once('close', resolve);
  });
}

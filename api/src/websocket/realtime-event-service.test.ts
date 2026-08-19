import { expect } from 'chai';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { forwardRealtimeEvent, registerRealtimeSocket } from './realtime-event-service';

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  bufferedAmount = 0;
  sent: string[] = [];
  closedCode: number | null = null;
  isAlive = true;

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(code?: number): void {
    this.closedCode = code ?? 1000;
  }

  ping(): void {}

  terminate(): void {}
}

describe('realtime-event-service', () => {
  it('forwards tiny events only to profiles that can see the task', () => {
    const allowed = new FakeSocket();
    const denied = new FakeSocket();
    const unregisterAllowed = registerRealtimeSocket(
      allowed as unknown as WebSocket,
      'profile-allowed',
      new Set(['task-1'])
    );
    const unregisterDenied = registerRealtimeSocket(
      denied as unknown as WebSocket,
      'profile-denied',
      new Set(['task-2'])
    );

    forwardRealtimeEvent({
      type: 'task.updated',
      task_id: 'task-1',
      status: 'running'
    });

    expect(allowed.sent).to.deep.equal([
      JSON.stringify({
        type: 'task.updated',
        task_id: 'task-1',
        status: 'running'
      })
    ]);
    expect(denied.sent).to.deep.equal([]);
    unregisterAllowed();
    unregisterDenied();
  });

  it('disconnects a slow client instead of growing its buffer', () => {
    const socket = new FakeSocket();
    socket.bufferedAmount = 1024 * 1024 + 1;
    const unregister = registerRealtimeSocket(socket as unknown as WebSocket, 'profile-slow', new Set(['task-1']));

    forwardRealtimeEvent({
      type: 'task.updated',
      task_id: 'task-1',
      status: 'completed'
    });

    expect(socket.closedCode).to.equal(1013);
    expect(socket.sent).to.deep.equal([]);
    unregister();
  });
});

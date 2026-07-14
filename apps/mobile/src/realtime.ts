import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

/** Payload broadcast by the API's realtime gateway to a group's room. */
export interface GroupEvent {
  type: 'expense.created' | 'expense.updated' | 'expense.deleted' | 'balances.updated';
}

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { path: '/realtime', transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

/**
 * Subscribe to realtime updates for a group and invoke `onEvent` whenever the
 * server reports a change. Callers use this to invalidate/refetch cached data
 * (React Query in a fuller build; a manual refresh here).
 */
export function useGroupRealtime(groupId: string | null, onEvent: (e: GroupEvent) => void): void {
  useEffect(() => {
    if (!groupId) return;
    const s = getSocket();
    const handler = (e: GroupEvent): void => onEvent(e);
    const subscribe = (): void => {
      s.emit('group.subscribe', { groupId });
    };
    s.on('connect', subscribe);
    s.on('group.event', handler);
    if (s.connected) subscribe();

    return () => {
      s.emit('group.unsubscribe', { groupId });
      s.off('connect', subscribe);
      s.off('group.event', handler);
    };
  }, [groupId, onEvent]);
}

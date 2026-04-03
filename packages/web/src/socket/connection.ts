import { io, Socket } from 'socket.io-client';
import { useSocketStore } from '../stores/socketStore.js';
import { bindRoomEvents } from './roomEvents.js';
import { bindGameEvents } from './gameEvents.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

let socket: Socket | null = null;

export function connectSocket(token: string, roomId?: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SERVER_URL, {
    auth: { token },
    query: roomId ? { roomId } : {},
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  const store = useSocketStore.getState();
  store.setSocket(socket);

  socket.on('connect', () => {
    useSocketStore.getState().setStatus('connected');
  });

  socket.on('disconnect', () => {
    useSocketStore.getState().setStatus('reconnecting');
  });

  socket.on('connect_error', () => {
    useSocketStore.getState().setStatus('failed');
  });

  socket.io.on('reconnect', () => {
    useSocketStore.getState().setStatus('connected');
  });

  socket.io.on('reconnect_failed', () => {
    useSocketStore.getState().setStatus('failed');
  });

  bindRoomEvents(socket);
  bindGameEvents(socket);

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    useSocketStore.getState().setSocket(null);
    useSocketStore.getState().setStatus('disconnected');
  }
}

export function getSocket(): Socket | null {
  return socket;
}

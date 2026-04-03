import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting' | 'failed';

interface SocketState {
  socket: Socket | null;
  status: ConnectionStatus;
  setSocket: (socket: Socket | null) => void;
  setStatus: (status: ConnectionStatus) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  status: 'disconnected',
  setSocket: (socket) => set({ socket }),
  setStatus: (status) => set({ status }),
}));

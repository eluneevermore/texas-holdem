import { create } from 'zustand';
import type { RoomConfig, RoomPlayer, RoomState } from '@poker/shared';

interface RoomStoreState {
  roomId: string | null;
  roomCode: string | null;
  hostId: string | null;
  state: RoomState | null;
  handCount: number;
  config: RoomConfig | null;
  players: RoomPlayer[];

  setRoom: (data: {
    roomId: string;
    roomCode: string;
    hostId: string;
    state: RoomState;
    handCount: number;
    config: RoomConfig;
    players: RoomPlayer[];
  }) => void;
  setConfig: (config: RoomConfig) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  addPlayer: (player: RoomPlayer) => void;
  removePlayer: (playerId: string) => void;
  updatePlayerReady: (playerId: string, isReady: boolean) => void;
  setHost: (hostId: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomId: null,
  roomCode: null,
  hostId: null,
  state: null,
  handCount: 0,
  config: null,
  players: [],

  setRoom: (data) => set(data),
  setConfig: (config) => set({ config }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((s) => ({ players: [...s.players, player] })),
  removePlayer: (playerId) =>
    set((s) => ({ players: s.players.filter((p) => p.playerId !== playerId) })),
  updatePlayerReady: (playerId, isReady) =>
    set((s) => ({
      players: s.players.map((p) =>
        p.playerId === playerId ? { ...p, isReady } : p,
      ),
    })),
  setHost: (hostId) =>
    set((s) => ({
      hostId,
      players: s.players.map((p) => ({ ...p, isHost: p.playerId === hostId })),
    })),
  clearRoom: () =>
    set({ roomId: null, roomCode: null, hostId: null, state: null, handCount: 0, config: null, players: [] }),
}));

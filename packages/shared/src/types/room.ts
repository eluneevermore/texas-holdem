import type { RoomPlayer } from './player.js';

export enum RoomState {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  CLOSED = 'CLOSED',
}

export interface RoomConfig {
  smallBlind: number;
  bigBlind: number;
  initialStack: number;
  buyInAllowed: boolean;
  buyInAmount: number;
  maxPlayers: number;
}

export interface Room {
  roomId: string;
  roomCode: string;
  hostId: string;
  state: RoomState;
  handCount: number;
  config: RoomConfig;
  players: RoomPlayer[];
  createdAt: Date;
  closedAt?: Date;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  smallBlind: 10,
  bigBlind: 20,
  initialStack: 1000,
  buyInAllowed: true,
  buyInAmount: 1000,
  maxPlayers: 9,
};

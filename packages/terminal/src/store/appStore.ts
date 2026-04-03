import type { RoomConfig, RoomPlayer, Card, Pot } from '@poker/shared';

export interface AppState {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  isGuest: boolean;

  roomId: string | null;
  roomCode: string | null;
  hostId: string | null;
  roomState: string | null;
  config: RoomConfig | null;
  players: RoomPlayer[];

  handId: string | null;
  handNumber: number;
  phase: string | null;
  communityCards: Card[];
  holeCards: Card[];
  pots: Pot[];
  dealerSeatIndex: number;
  turnPlayerId: string | null;
  turnSecondsRemaining: number;
  turnCanCheck: boolean;
  turnCanRaise: boolean;
  turnCallAmount: number;
  turnMinRaise: number;

  winners: { playerId: string; amount: number; handRank?: string }[];
  messages: string[];
}

export function createInitialState(): AppState {
  return {
    token: null, userId: null, displayName: null, isGuest: false,
    roomId: null, roomCode: null, hostId: null, roomState: null,
    config: null, players: [],
    handId: null, handNumber: 0, phase: null,
    communityCards: [], holeCards: [], pots: [],
    dealerSeatIndex: 0,
    turnPlayerId: null, turnSecondsRemaining: 0,
    turnCanCheck: false, turnCanRaise: false,
    turnCallAmount: 0, turnMinRaise: 0,
    winners: [], messages: [],
  };
}

/** Mutable singleton — simple state for TUI (no Zustand needed). */
let state = createInitialState();

export function getState(): AppState { return state; }
export function setState(partial: Partial<AppState>) { Object.assign(state, partial); }
export function resetState() { state = createInitialState(); }

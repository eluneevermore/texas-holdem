import type { Card } from './card.js';

export enum HandPhase {
  PRE_DEAL = 'PRE_DEAL',
  PRE_FLOP = 'PRE_FLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
  COMPLETE = 'COMPLETE',
}

export enum ActionType {
  FOLD = 'FOLD',
  CHECK = 'CHECK',
  CALL = 'CALL',
  RAISE = 'RAISE',
  ALL_IN = 'ALL_IN',
}

export enum HandState {
  ACTIVE = 'ACTIVE',
  FOLDED = 'FOLDED',
  ALL_IN = 'ALL_IN',
}

export interface PlayerAction {
  type: ActionType;
  amount?: number;
  phase: HandPhase;
  timestamp: Date;
}

export interface HandPlayer {
  playerId: string;
  seatIndex: number;
  holeCards: Card[];
  mucked: boolean;
  chipsAtStart: number;
  chipsAtEnd?: number;
  actions: PlayerAction[];
  handState: HandState;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface HandWinner {
  playerId: string;
  potIndex: number;
  amount: number;
  handRank?: string;
  mucked: boolean;
}

export interface GameHand {
  handId: string;
  roomId: string;
  handNumber: number;
  dealerSeatIndex: number;
  communityCards: Card[];
  pots: Pot[];
  players: HandPlayer[];
  winners: HandWinner[];
  phase: HandPhase;
  activePlayerSeatIndex: number | null;
  currentBet: number;
  startedAt: Date;
  completedAt?: Date;
}

// ---------------------------------------------------------------------------
// Game public state — single authoritative snapshot broadcast to all players
// ---------------------------------------------------------------------------

export interface GamePlayerPublicState {
  playerId: string;
  displayName: string;
  seatIndex: number;
  chips: number;
  chipsAtStart: number;
  currentRoundBet: number;
  totalBet: number;
  handState: HandState;
  isDealer: boolean;
  isTurn: boolean;
  buyInCount: number;
  lastAction: { type: ActionType; amount: number } | null;
}

export interface ActivePlayerActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
}

export interface ShowdownPlayerState {
  playerId: string;
  holeCards: Card[];
  handRank: string;
  mucked: boolean;
}

export interface WinnerState {
  playerId: string;
  potIndex: number;
  amount: number;
  handRank?: string;
}

export interface GamePublicState {
  handId: string;
  handNumber: number;
  phase: HandPhase;
  dealerSeatIndex: number;
  smallBlind: number;
  bigBlind: number;
  communityCards: Card[];
  pots: Pot[];
  totalPot: number;
  currentBet: number;
  players: GamePlayerPublicState[];
  activePlayerId: string | null;
  activePlayerTimeoutAt: number | null;
  activePlayerActions: ActivePlayerActions | null;
  winners: WinnerState[] | null;
  showdown: ShowdownPlayerState[] | null;
}

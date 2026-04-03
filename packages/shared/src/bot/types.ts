import type { Card, Pot } from '../types/index.js';

export interface BotOpponent {
  playerId: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  handState: 'ACTIVE' | 'FOLDED' | 'ALL_IN';
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

export interface BotGameState {
  botPlayerId: string;
  botSeatIndex: number;
  botHoleCards: Card[];
  botChips: number;

  phase: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER';
  communityCards: Card[];
  pots: Pot[];
  currentBet: number;
  botCurrentBet: number;
  callAmount: number;
  minRaiseAmount: number;
  maxRaiseAmount: number;

  opponents: BotOpponent[];
  dealerSeatIndex: number;
  handNumber: number;
}

export interface BotDecision {
  action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN';
  amount?: number;
}

export type BotStrategy = (state: BotGameState) => BotDecision;

export enum BotDifficulty {
  NORMAL = 'NORMAL',
}

import { create } from 'zustand';
import type { Card, Pot, HandPhase } from '@poker/shared';

interface TurnInfo {
  playerId: string;
  timeoutAt: number;
  canCheck: boolean;
  canRaise: boolean;
  callAmount: number;
  minRaise: number;
  secondsRemaining: number;
}

interface PlayerChips {
  playerId: string;
  chips: number;
  chipsAtStart: number;
  currentBet: number;
}

interface WinnerInfo {
  playerId: string;
  potIndex: number;
  amount: number;
  handRank?: string;
}

interface ShowdownPlayer {
  playerId: string;
  holeCards: Card[];
  handRank: string;
  mucked: boolean;
}

interface GameState {
  handId: string | null;
  handNumber: number;
  phase: HandPhase | null;
  communityCards: Card[];
  holeCards: Card[];
  pots: Pot[];
  playerChips: PlayerChips[];
  turn: TurnInfo | null;
  dealerSeatIndex: number;
  winners: WinnerInfo[];
  showdownPlayers: ShowdownPlayer[];

  setHandStart: (data: {
    handId: string;
    handNumber: number;
    dealerSeatIndex: number;
    players: { playerId: string; seatIndex: number; chips: number; chipsAtStart: number }[];
  }) => void;
  setHoleCards: (cards: Card[]) => void;
  setPhase: (phase: HandPhase, communityCards: Card[]) => void;
  setTurn: (turn: TurnInfo) => void;
  updateTimer: (secondsRemaining: number) => void;
  clearTurn: () => void;
  updatePots: (pots: Pot[]) => void;
  updatePlayerBet: (playerId: string, amount: number) => void;
  setShowdown: (players: ShowdownPlayer[]) => void;
  setWinners: (winners: WinnerInfo[], playerChips: { id: string; chipsEnd: number }[]) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  handId: null,
  handNumber: 0,
  phase: null,
  communityCards: [],
  holeCards: [],
  pots: [],
  playerChips: [],
  turn: null,
  dealerSeatIndex: 0,
  winners: [],
  showdownPlayers: [],

  setHandStart: ({ handId, handNumber, dealerSeatIndex, players }) =>
    set({
      handId,
      handNumber,
      dealerSeatIndex,
      phase: 'PRE_FLOP' as HandPhase,
      communityCards: [],
      holeCards: [],
      pots: [],
      winners: [],
      showdownPlayers: [],
      playerChips: players.map((p) => ({
        playerId: p.playerId,
        chips: p.chips,
        chipsAtStart: p.chipsAtStart,
        currentBet: 0,
      })),
    }),
  setHoleCards: (cards) => set({ holeCards: cards }),
  setPhase: (phase, communityCards) => set({ phase, communityCards }),
  setTurn: (turn) => set({ turn }),
  updateTimer: (secondsRemaining) =>
    set((s) => (s.turn ? { turn: { ...s.turn, secondsRemaining } } : {})),
  clearTurn: () => set({ turn: null }),
  updatePots: (pots) => set({ pots }),
  updatePlayerBet: (playerId, amount) =>
    set((s) => ({
      playerChips: s.playerChips.map((p) =>
        p.playerId === playerId ? { ...p, currentBet: amount } : p,
      ),
    })),
  setShowdown: (players) => set({ showdownPlayers: players }),
  setWinners: (winners, playerChips) =>
    set((s) => ({
      winners,
      playerChips: s.playerChips.map((p) => {
        const updated = playerChips.find((u) => u.id === p.playerId);
        return updated ? { ...p, chips: updated.chipsEnd } : p;
      }),
    })),
  clearGame: () =>
    set({
      handId: null,
      handNumber: 0,
      phase: null,
      communityCards: [],
      holeCards: [],
      pots: [],
      playerChips: [],
      turn: null,
      dealerSeatIndex: 0,
      winners: [],
      showdownPlayers: [],
    }),
}));

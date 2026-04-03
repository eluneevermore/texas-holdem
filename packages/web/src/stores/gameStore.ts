import { create } from 'zustand';
import type { Card, GamePublicState } from '@poker/shared';

interface GameState {
  /** The authoritative public game state from the server. */
  publicState: GamePublicState | null;
  /** Private hole cards (only sent to this player). */
  holeCards: Card[];
  /** Turn-timer countdown (updated by TIMER_TICK). */
  timerSecondsRemaining: number | null;

  setGameState: (state: GamePublicState) => void;
  setHoleCards: (cards: Card[]) => void;
  updateTimer: (seconds: number) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  publicState: null,
  holeCards: [],
  timerSecondsRemaining: null,

  setGameState: (state) =>
    set({
      publicState: state,
      timerSecondsRemaining: state.activePlayerId ? 30 : null,
    }),

  setHoleCards: (cards) => set({ holeCards: cards }),

  updateTimer: (seconds) => set({ timerSecondsRemaining: seconds }),

  clearGame: () =>
    set({
      publicState: null,
      holeCards: [],
      timerSecondsRemaining: null,
    }),
}));

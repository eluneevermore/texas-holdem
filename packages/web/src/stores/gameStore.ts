import { create } from 'zustand';
import type { Card, GamePublicState } from '@poker/shared';

interface GameState {
  publicState: GamePublicState | null;
  holeCards: Card[];
  timerSecondsRemaining: number | null;
  /** The handId for which we received hole cards — stale cards are cleared on hand change. */
  holeCardsHandId: string | null;

  setGameState: (state: GamePublicState, myUserId: string | null) => void;
  setHoleCards: (cards: Card[]) => void;
  updateTimer: (seconds: number) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  publicState: null,
  holeCards: [],
  timerSecondsRemaining: null,
  holeCardsHandId: null,

  setGameState: (state, myUserId) => {
    const prev = get();
    const handChanged = prev.holeCardsHandId !== null && prev.holeCardsHandId !== state.handId;
    const isParticipant = myUserId != null && state.players.some((p) => p.playerId === myUserId);

    set({
      publicState: state,
      timerSecondsRemaining: state.activePlayerId ? (prev.timerSecondsRemaining ?? 30) : null,
      // Clear stale hole cards when hand changes or user isn't in the hand
      holeCards: (handChanged || !isParticipant) ? [] : prev.holeCards,
      holeCardsHandId: (handChanged || !isParticipant) ? null : prev.holeCardsHandId,
    });
  },

  setHoleCards: (cards) =>
    set((s) => ({
      holeCards: cards,
      holeCardsHandId: s.publicState?.handId ?? null,
    })),

  updateTimer: (seconds) => set({ timerSecondsRemaining: seconds }),

  clearGame: () =>
    set({
      publicState: null,
      holeCards: [],
      timerSecondsRemaining: null,
      holeCardsHandId: null,
    }),
}));

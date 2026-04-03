import type { Socket } from 'socket.io-client';
import { GAME_EVENTS } from '@poker/shared';
import type { GamePublicState } from '@poker/shared';
import { useGameStore } from '../stores/gameStore.js';

export function bindGameEvents(socket: Socket) {
  socket.on(GAME_EVENTS.STATE_UPDATE, (state: GamePublicState) => {
    useGameStore.getState().setGameState(state);
  });

  socket.on(GAME_EVENTS.DEAL_HOLE_CARDS, ({ cards }) => {
    useGameStore.getState().setHoleCards(cards);
  });

  socket.on(GAME_EVENTS.TIMER_TICK, ({ secondsRemaining }) => {
    useGameStore.getState().updateTimer(secondsRemaining);
  });
}

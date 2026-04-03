import type { Socket } from 'socket.io-client';
import { GAME_EVENTS } from '@poker/shared';
import { useGameStore } from '../stores/gameStore.js';

export function bindGameEvents(socket: Socket) {
  socket.on(GAME_EVENTS.START, (data) => {
    useGameStore.getState().setHandStart(data);
  });

  socket.on(GAME_EVENTS.DEAL_HOLE_CARDS, ({ cards }) => {
    useGameStore.getState().setHoleCards(cards);
  });

  socket.on(GAME_EVENTS.PHASE_CHANGE, ({ phase, communityCards }) => {
    useGameStore.getState().setPhase(phase, communityCards);
  });

  socket.on(GAME_EVENTS.TURN_START, (data) => {
    useGameStore.getState().setTurn({ ...data, secondsRemaining: 30 });
  });

  socket.on(GAME_EVENTS.TIMER_TICK, ({ secondsRemaining }) => {
    useGameStore.getState().updateTimer(secondsRemaining);
  });

  socket.on(GAME_EVENTS.ACTION_BROADCAST, ({ playerId, action }) => {
    useGameStore.getState().clearTurn();
    if (action.amount) {
      useGameStore.getState().updatePlayerBet(playerId, action.amount);
    }
  });

  socket.on(GAME_EVENTS.POT_UPDATE, ({ pots }) => {
    useGameStore.getState().updatePots(pots);
  });

  socket.on(GAME_EVENTS.SHOWDOWN, ({ players }) => {
    useGameStore.getState().setShowdown(players);
  });

  socket.on(GAME_EVENTS.HAND_RESULT, ({ winners, players }) => {
    useGameStore.getState().setWinners(winners, players);
  });
}

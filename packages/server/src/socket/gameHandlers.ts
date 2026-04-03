import type { Server, Socket } from 'socket.io';
import {
  GAME_EVENTS,
  HandPhase, ActionType, PlayerState, RoomState,
  TURN_TIMER_SECONDS, BETWEEN_HAND_PAUSE_SECONDS, AFK_TIMEOUT_THRESHOLD,
} from '@poker/shared';
import type { ShuffleFn } from '@poker/shared';
import { roomManager } from '../game/roomManager.js';
import {
  startHand, processAction, getActivePlayer, getActivePlayerActions,
  type HandContext,
} from '../game/handStateMachine.js';
import { playerSocketMap } from './roomHandlers.js';
import { runBotTurn, setBroadcastCallback } from '../bots/botRunner.js';
import { v4 as uuid } from 'uuid';

const activeHands = new Map<string, HandContext>();
const turnTimers = new Map<string, NodeJS.Timeout>();

const playerRoomMap = new Map<string, string>();

/** Override the shuffle function for deterministic testing. null = default. */
let shuffleOverride: ShuffleFn | null = null;
export function setShuffleOverride(fn: ShuffleFn | null) { shuffleOverride = fn; }

setBroadcastCallback(broadcastAction);

export function registerGameHandlers(io: Server, socket: Socket, userId: string) {
  socket.on(GAME_EVENTS.ACTION, (data: { type: string; amount?: number }) => {
    const roomId = findPlayerRoom(userId);
    if (!roomId) return;

    const ctx = activeHands.get(roomId);
    if (!ctx) {
      socket.emit('error', { code: 'NO_ACTIVE_HAND', message: 'No hand in progress' });
      return;
    }

    const result = processAction(ctx, userId, {
      type: data.type as ActionType,
      amount: data.amount,
    });

    if ('error' in result) {
      socket.emit('error', { code: 'INVALID_ACTION', message: result.error });
      return;
    }

    const player = ctx.players.find((p) => p.playerId === userId);
    if (player) player.consecutiveTimeouts = 0;

    broadcastAction(io, roomId, ctx, result);
  });

  socket.on(GAME_EVENTS.BUY_IN, () => {
    const roomId = playerRoomMap.get(userId);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (!room || !room.config.buyInAllowed) return;

    const player = room.players.find((p) => p.playerId === userId);
    if (!player || player.playerState !== PlayerState.OBSERVER) return;

    player.chips = room.config.buyInAmount;
    player.playerState = PlayerState.SITTING_OUT;
    player.buyInCount++;

    io.to(roomId).emit(GAME_EVENTS.BUY_IN_CONFIRMED, {
      playerId: userId,
      chips: player.chips,
      buyInCount: player.buyInCount,
    });
  });

  socket.on(GAME_EVENTS.HAND_HISTORY, ({ limit }: { limit: number }) => {
    socket.emit(GAME_EVENTS.HAND_HISTORY_RESULT, { hands: [] });
  });
}

export function trackPlayerRoom(playerId: string, roomId: string) {
  playerRoomMap.set(playerId, roomId);
}

export function untrackPlayerRoom(playerId: string) {
  playerRoomMap.delete(playerId);
}

export function startGameForRoom(io: Server, roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  roomManager.setRoomState(roomId, RoomState.PLAYING);
  room.handCount++;

  const activePlayers = room.players.filter(
    (p) => p.playerState === PlayerState.WAITING || p.playerState === PlayerState.SITTING_OUT,
  );

  if (activePlayers.length < 2) return;

  for (const p of activePlayers) {
    p.playerState = PlayerState.ACTIVE;
  }

  const dealerSeatIndex = room.handCount === 1
    ? activePlayers[0].seatIndex
    : getNextDealer(activePlayers, room.handCount);

  const handId = uuid();
  const ctx = startHand(
    handId, roomId, room.handCount,
    activePlayers, dealerSeatIndex,
    room.config.smallBlind, room.config.bigBlind,
    shuffleOverride ?? undefined,
  );

  activeHands.set(roomId, ctx);

  io.to(roomId).emit(GAME_EVENTS.START, {
    handId,
    handNumber: room.handCount,
    dealerSeatIndex,
    players: ctx.players.map((p) => ({
      playerId: p.playerId,
      seatIndex: p.seatIndex,
      chips: p.chips,
      chipsAtStart: p.chipsAtStart,
    })),
  });

  // Hole cards — targeted emit only (never broadcast)
  for (const p of ctx.players) {
    const socketId = playerSocketMap.get(p.playerId);
    if (socketId) {
      io.to(socketId).emit(GAME_EVENTS.DEAL_HOLE_CARDS, { cards: p.holeCards });
    }
  }

  startTurnTimer(io, roomId, ctx);
}

function broadcastAction(
  io: Server,
  roomId: string,
  ctx: HandContext,
  result: Exclude<ReturnType<typeof processAction>, { error: string }>,
) {
  clearTurnTimer(roomId);

  io.to(roomId).emit(GAME_EVENTS.ACTION_BROADCAST, {
    playerId: result.playerId,
    action: { type: result.type, amount: result.amount },
  });

  if (result.updatedPots) {
    io.to(roomId).emit(GAME_EVENTS.POT_UPDATE, {
      pots: result.updatedPots,
      currentRoundBets: ctx.players.map((p) => ({
        playerId: p.playerId,
        amount: p.currentRoundBet,
      })),
    });
  }

  if (result.newCommunityCards) {
    io.to(roomId).emit(GAME_EVENTS.PHASE_CHANGE, {
      phase: result.newPhase,
      communityCards: ctx.communityCards,
    });
  }

  if (result.showdownResults) {
    io.to(roomId).emit(GAME_EVENTS.SHOWDOWN, { players: result.showdownResults });
  }

  if (result.winners) {
    io.to(roomId).emit(GAME_EVENTS.HAND_RESULT, {
      winners: result.winners,
      players: ctx.players.map((p) => ({
        id: p.playerId,
        chipsEnd: p.chips,
      })),
    });

    // Sync chip counts and mark broke players
    const room = roomManager.getRoom(roomId);
    if (room) {
      for (const p of room.players) {
        const hp = ctx.players.find((hp) => hp.playerId === p.playerId);
        if (hp) {
          p.chips = hp.chips;
          if (hp.chips === 0) {
            p.playerState = PlayerState.OBSERVER;
            io.to(roomId).emit(GAME_EVENTS.PLAYER_BROKE, { playerId: p.playerId });
          }
        }
      }
    }

    activeHands.delete(roomId);

    setTimeout(() => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      for (const p of room.players) {
        if (p.playerState === PlayerState.ACTIVE || p.playerState === PlayerState.SITTING_OUT) {
          p.playerState = PlayerState.WAITING;
        }
      }

      const eligible = room.players.filter(
        (p) => p.chips > 0 && p.playerState !== PlayerState.LEFT && p.playerState !== PlayerState.OBSERVER,
      );

      if (eligible.length >= 2) {
        roomManager.setRoomState(roomId, RoomState.WAITING);
        startGameForRoom(io, roomId);
      } else {
        roomManager.setRoomState(roomId, RoomState.WAITING);
      }
    }, BETWEEN_HAND_PAUSE_SECONDS * 1000);

    return;
  }

  startTurnTimer(io, roomId, ctx);
}

function startTurnTimer(io: Server, roomId: string, ctx: HandContext) {
  const active = getActivePlayer(ctx);
  if (!active) return;

  const actions = getActivePlayerActions(ctx);
  if (!actions) return;

  io.to(roomId).emit(GAME_EVENTS.TURN_START, {
    playerId: active.playerId,
    timeoutAt: Date.now() + TURN_TIMER_SECONDS * 1000,
    canCheck: actions.actions.canCheck,
    canRaise: actions.actions.canRaise,
    callAmount: actions.actions.callAmount,
    minRaise: actions.actions.minRaiseTotal,
  });

  let secondsLeft = TURN_TIMER_SECONDS;

  const timer = setInterval(() => {
    secondsLeft--;
    io.to(roomId).emit(GAME_EVENTS.TIMER_TICK, {
      playerId: active.playerId,
      secondsRemaining: secondsLeft,
    });

    if (secondsLeft <= 0) {
      clearInterval(timer);
      turnTimers.delete(roomId);
      handleTimeout(io, roomId, ctx, active.playerId);
    }
  }, 1000);

  turnTimers.set(roomId, timer);

  if (isBot(active.playerId, roomId)) {
    clearInterval(timer);
    turnTimers.delete(roomId);
    runBotTurn(io, roomId, ctx, active);
  }
}

function handleTimeout(io: Server, roomId: string, ctx: HandContext, playerId: string) {
  const player = ctx.players.find((p) => p.playerId === playerId);
  if (!player) return;

  player.consecutiveTimeouts++;

  if (player.consecutiveTimeouts >= AFK_TIMEOUT_THRESHOLD) {
    io.to(roomId).emit(GAME_EVENTS.PLAYER_AFK, {
      playerId,
      consecutiveTimeouts: player.consecutiveTimeouts,
    });
  }

  const actions = getActivePlayerActions(ctx);
  const actionType = actions?.actions.canCheck ? ActionType.CHECK : ActionType.FOLD;

  const result = processAction(ctx, playerId, { type: actionType });
  if ('error' in result) return;

  broadcastAction(io, roomId, ctx, result);
}

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    turnTimers.delete(roomId);
  }
}

function isBot(playerId: string, roomId: string): boolean {
  const room = roomManager.getRoom(roomId);
  if (!room) return false;
  return room.players.some((p) => p.playerId === playerId && p.isBot);
}

function findPlayerRoom(playerId: string): string | null {
  // Check active hands first
  for (const [roomId, ctx] of activeHands) {
    if (ctx.players.some((p) => p.playerId === playerId)) return roomId;
  }
  // Fall back to persistent map (covers between-hand state)
  return playerRoomMap.get(playerId) ?? null;
}

function getNextDealer(players: { seatIndex: number }[], handNumber: number): number {
  const seats = players.map((p) => p.seatIndex).sort((a, b) => a - b);
  return seats[(handNumber - 1) % seats.length];
}

/** Reset all in-memory state — for testing only. */
export function resetGameState() {
  for (const timer of turnTimers.values()) clearInterval(timer);
  activeHands.clear();
  turnTimers.clear();
  playerRoomMap.clear();
  shuffleOverride = null;
}

export { activeHands };

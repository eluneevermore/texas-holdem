import type { Server } from 'socket.io';
import {
  ActionType,
  BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS,
  botStrategies, BotDifficulty,
} from '@poker/shared';
import type { BotGameState, BotOpponent } from '@poker/shared';
import { roomManager } from '../game/roomManager.js';
import {
  processAction, getActivePlayerActions,
  type HandContext, type HandPlayerState,
} from '../game/handStateMachine.js';

/** Callback for broadcasting the result through the same path as human actions. */
let broadcastCallback: ((io: Server, roomId: string, ctx: HandContext, result: Exclude<ReturnType<typeof processAction>, { error: string }>) => void) | null = null;
const botTurnTimers = new Map<string, Set<NodeJS.Timeout>>();

export function setBroadcastCallback(cb: typeof broadcastCallback) {
  broadcastCallback = cb;
}

/**
 * Execute a bot's turn after a randomised thinking delay.
 * Runs in-process — no separate socket connection needed.
 */
export function runBotTurn(
  io: Server,
  roomId: string,
  ctx: HandContext,
  botPlayer: HandPlayerState,
) {
  const delay = BOT_DELAY_MIN_MS + Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS);

  const timer = setTimeout(() => {
    unregisterBotTimer(roomId, timer);

    if (!roomManager.getRoom(roomId)) return;

    const activeInfo = getActivePlayerActions(ctx);
    if (!activeInfo || activeInfo.player.playerId !== botPlayer.playerId) return;

    const gameState = buildBotGameState(ctx, botPlayer);
    const strategy = botStrategies[BotDifficulty.NORMAL];
    const decision = strategy(gameState);

    const actionType = decision.action as ActionType;
    const result = processAction(ctx, botPlayer.playerId, {
      type: actionType,
      amount: decision.amount,
    });

    if ('error' in result) {
      const fallbackType = activeInfo.actions.canCheck ? ActionType.CHECK : ActionType.FOLD;
      const fallbackResult = processAction(ctx, botPlayer.playerId, { type: fallbackType });
      if (!('error' in fallbackResult)) {
        broadcastCallback?.(io, roomId, ctx, fallbackResult);
      }
      return;
    }

    broadcastCallback?.(io, roomId, ctx, result);
  }, delay);

  registerBotTimer(roomId, timer);
}

export function clearBotTimers(roomId: string) {
  const timers = botTurnTimers.get(roomId);
  if (!timers) return;

  for (const timer of timers) {
    clearTimeout(timer);
  }

  botTurnTimers.delete(roomId);
}

export function clearAllBotTimers() {
  for (const timers of botTurnTimers.values()) {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  }

  botTurnTimers.clear();
}

export function getBotTimerCount(roomId?: string): number {
  if (roomId) return botTurnTimers.get(roomId)?.size ?? 0;
  return [...botTurnTimers.values()].reduce((count, timers) => count + timers.size, 0);
}

function registerBotTimer(roomId: string, timer: NodeJS.Timeout) {
  let timers = botTurnTimers.get(roomId);
  if (!timers) {
    timers = new Set<NodeJS.Timeout>();
    botTurnTimers.set(roomId, timers);
  }
  timers.add(timer);
}

function unregisterBotTimer(roomId: string, timer: NodeJS.Timeout) {
  const timers = botTurnTimers.get(roomId);
  if (!timers) return;

  timers.delete(timer);
  if (timers.size === 0) {
    botTurnTimers.delete(roomId);
  }
}

function buildBotGameState(ctx: HandContext, bot: HandPlayerState): BotGameState {
  const opponents: BotOpponent[] = ctx.players
    .filter((p) => p.playerId !== bot.playerId)
    .map((p) => ({
      playerId: p.playerId,
      seatIndex: p.seatIndex,
      chips: p.chips,
      currentBet: p.currentRoundBet,
      handState: p.handState as 'ACTIVE' | 'FOLDED' | 'ALL_IN',
      isDealer: p.seatIndex === ctx.dealerSeatIndex,
      isSmallBlind: false,
      isBigBlind: false,
    }));

  const activeActions = getActivePlayerActions(ctx);

  return {
    botPlayerId: bot.playerId,
    botSeatIndex: bot.seatIndex,
    botHoleCards: bot.holeCards,
    botChips: bot.chips,
    phase: ctx.phase as 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER',
    communityCards: ctx.communityCards,
    pots: ctx.pots,
    currentBet: ctx.currentBet,
    botCurrentBet: bot.currentRoundBet,
    callAmount: activeActions?.actions.callAmount ?? 0,
    minRaiseAmount: activeActions?.actions.minRaiseTotal ?? ctx.bigBlind * 2,
    maxRaiseAmount: activeActions?.actions.maxRaiseTotal ?? bot.chips,
    opponents,
    dealerSeatIndex: ctx.dealerSeatIndex,
    handNumber: ctx.handNumber,
  };
}

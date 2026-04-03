import type { Server } from 'socket.io';
import {
  GAME_EVENTS, ActionType,
  BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS,
  botStrategies, BotDifficulty,
} from '@poker/shared';
import type { BotGameState, BotOpponent } from '@poker/shared';
import { roomManager } from '../game/roomManager.js';
import {
  processAction, getActivePlayerActions,
  type HandContext, type HandPlayerState,
} from '../game/handStateMachine.js';

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

  setTimeout(() => {
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
      // Fallback: if bot's decision was invalid, fold or check
      const fallbackType = activeInfo.actions.canCheck ? ActionType.CHECK : ActionType.FOLD;
      const fallbackResult = processAction(ctx, botPlayer.playerId, { type: fallbackType });
      if (!('error' in fallbackResult)) {
        broadcastBotAction(io, roomId, ctx, fallbackResult);
      }
      return;
    }

    broadcastBotAction(io, roomId, ctx, result);
  }, delay);
}

function broadcastBotAction(
  io: Server,
  roomId: string,
  ctx: HandContext,
  result: Exclude<ReturnType<typeof processAction>, { error: string }>,
) {
  // Re-use the same broadcast flow as gameHandlers
  // Import dynamically to avoid circular dependency
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

import { ActionType } from '../types/game.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';

export interface BettingContext {
  /** The highest bet in the current round. */
  currentBet: number;
  /** How much this player has already bet in this round. */
  playerCurrentBet: number;
  /** Player's remaining chip count. */
  playerChips: number;
  /** The size of the last raise (or bigBlind if no raise yet). */
  lastRaiseSize: number;
  /** Whether this player has already acted and faces only a sub-minimum all-in (re-raise closed). */
  hasActed: boolean;
  /** Whether a full raise has been made since this player last acted. */
  facesFullRaise: boolean;
  /** True if this is the big blind pre-flop and no one has raised. */
  isBigBlindOption: boolean;
}

export interface AvailableActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTotal: number;
  maxRaiseTotal: number;
}

/**
 * Determine the legal actions for a player given the current betting context.
 */
export function getAvailableActions(ctx: BettingContext): AvailableActions {
  const toCall = ctx.currentBet - ctx.playerCurrentBet;
  const canCheck = toCall <= 0;
  const canCall = toCall > 0 && ctx.playerChips > 0;
  const callAmount = Math.min(toCall, ctx.playerChips);

  // Can't raise if player has already acted and only faces a sub-minimum all-in
  const raiseBlocked = ctx.hasActed && !ctx.facesFullRaise;

  const minRaiseTotal = ctx.currentBet + ctx.lastRaiseSize;
  const maxRaiseTotal = ctx.playerCurrentBet + ctx.playerChips;
  const canRaise = !raiseBlocked && maxRaiseTotal > ctx.currentBet && ctx.playerChips > toCall;

  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTotal: Math.min(minRaiseTotal, maxRaiseTotal),
    maxRaiseTotal,
  };
}

export interface ActionInput {
  type: ActionType;
  amount?: number;
}

/**
 * Validate a player action against the current betting context.
 * Returns ok with the resolved action (normalizing ALL_IN amounts) or an error.
 */
export function validateAction(
  input: ActionInput,
  ctx: BettingContext,
): Result<{ type: ActionType; amount: number }> {
  const available = getAvailableActions(ctx);

  switch (input.type) {
    case ActionType.FOLD:
      return ok({ type: ActionType.FOLD, amount: 0 });

    case ActionType.CHECK:
      if (!available.canCheck) {
        return err('Cannot check when there is an outstanding bet');
      }
      return ok({ type: ActionType.CHECK, amount: 0 });

    case ActionType.CALL: {
      if (!available.canCall) {
        return err('Nothing to call');
      }
      // If calling would consume all chips, it's an all-in
      if (available.callAmount >= ctx.playerChips) {
        return ok({ type: ActionType.ALL_IN, amount: ctx.playerChips });
      }
      return ok({ type: ActionType.CALL, amount: available.callAmount });
    }

    case ActionType.RAISE: {
      if (!available.canRaise) {
        return err('Raise is not allowed');
      }
      const raiseTotal = input.amount ?? available.minRaiseTotal;
      if (raiseTotal > available.maxRaiseTotal) {
        return err(`Raise amount ${raiseTotal} exceeds max ${available.maxRaiseTotal}`);
      }
      // If raise total equals player's max, it's an all-in
      if (raiseTotal >= available.maxRaiseTotal) {
        return ok({ type: ActionType.ALL_IN, amount: ctx.playerChips });
      }
      if (raiseTotal < available.minRaiseTotal) {
        return err(`Raise amount ${raiseTotal} below minimum ${available.minRaiseTotal}`);
      }
      const chipsCost = raiseTotal - ctx.playerCurrentBet;
      return ok({ type: ActionType.RAISE, amount: chipsCost });
    }

    case ActionType.ALL_IN:
      if (ctx.playerChips <= 0) {
        return err('No chips to go all-in with');
      }
      return ok({ type: ActionType.ALL_IN, amount: ctx.playerChips });

    default:
      return err(`Unknown action type: ${input.type}`);
  }
}

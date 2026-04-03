import type { BotGameState, BotDecision } from '../types.js';
import { RANK_VALUES } from '../../types/card.js';
import { HandRank, evaluateHand } from '../../game/handEvaluator.js';
import type { Card } from '../../types/card.js';

/**
 * Normal difficulty bot strategy.
 *
 * Pre-flop: fold weak hands ~40%, call medium, raise strong ~20%.
 * Post-flop: evaluate hand strength, bluff ~10%, fold to large bets with weak holdings.
 * Uses seeded-random-style approach via deterministic hash so strategy is testable
 * when called repeatedly (statistical distribution over N runs).
 */
export function normalStrategy(state: BotGameState): BotDecision {
  if (state.phase === 'PRE_FLOP') {
    return preFlopDecision(state);
  }
  return postFlopDecision(state);
}

function preFlopDecision(state: BotGameState): BotDecision {
  const [card1, card2] = state.botHoleCards;
  const v1 = RANK_VALUES[card1.rank];
  const v2 = RANK_VALUES[card2.rank];
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  const suited = card1.suit === card2.suit;
  const paired = v1 === v2;

  const strength = handStrengthPreFlop(high, low, paired, suited);
  const rand = pseudoRandom(state.handNumber, v1, v2);

  if (strength >= 8) {
    // Premium hands (AA, KK, QQ, AKs): raise
    if (rand < 0.8) {
      return raiseOrAllIn(state, state.minRaiseAmount * (1.5 + rand));
    }
    return callOrCheck(state);
  }

  if (strength >= 5) {
    // Medium hands: mostly call, sometimes raise
    if (rand < 0.2) {
      return raiseOrAllIn(state, state.minRaiseAmount);
    }
    return callOrCheck(state);
  }

  // Weak hands: fold ~40%, call ~60% if cheap
  if (rand < 0.4 || state.callAmount > state.botChips * 0.15) {
    return state.callAmount === 0 ? { action: 'CHECK' } : { action: 'FOLD' };
  }
  return callOrCheck(state);
}

function postFlopDecision(state: BotGameState): BotDecision {
  const allCards: Card[] = [...state.botHoleCards, ...state.communityCards];
  const evaluated = evaluateHand(allCards);
  const rand = pseudoRandom(state.handNumber, allCards.length, evaluated.rank);

  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const betRatio = state.callAmount / Math.max(totalPot, 1);

  // Strong hands: raise aggressively
  if (evaluated.rank >= HandRank.THREE_OF_A_KIND) {
    if (rand < 0.6) {
      return raiseOrAllIn(state, state.minRaiseAmount * (1 + rand));
    }
    return callOrCheck(state);
  }

  // Decent hands (pair or better): call most bets
  if (evaluated.rank >= HandRank.ONE_PAIR) {
    if (betRatio > 0.5 && rand < 0.3) {
      return { action: 'FOLD' };
    }
    if (rand < 0.15 && state.callAmount === 0) {
      return raiseOrAllIn(state, state.minRaiseAmount);
    }
    return callOrCheck(state);
  }

  // Weak hands: bluff ~10% on flop, fold to large bets
  if (state.phase === 'FLOP' && state.callAmount === 0 && rand < 0.1) {
    return raiseOrAllIn(state, state.minRaiseAmount);
  }

  if (betRatio > 0.3) {
    return { action: 'FOLD' };
  }

  return state.callAmount === 0 ? { action: 'CHECK' } : { action: 'FOLD' };
}

function callOrCheck(state: BotGameState): BotDecision {
  if (state.callAmount === 0) return { action: 'CHECK' };
  if (state.callAmount >= state.botChips) return { action: 'ALL_IN' };
  return { action: 'CALL' };
}

function raiseOrAllIn(state: BotGameState, targetAmount: number): BotDecision {
  const amount = Math.min(Math.floor(targetAmount), state.maxRaiseAmount);
  if (amount >= state.botChips + state.botCurrentBet) {
    return { action: 'ALL_IN' };
  }
  if (amount < state.minRaiseAmount) {
    return callOrCheck(state);
  }
  return { action: 'RAISE', amount };
}

function handStrengthPreFlop(high: number, low: number, paired: boolean, suited: boolean): number {
  if (paired) {
    if (high >= 12) return 9;  // QQ+
    if (high >= 9) return 7;   // 99–JJ
    if (high >= 6) return 5;   // 66–88
    return 3;                   // 22–55
  }
  let score = (high - 8) + (low - 6) * 0.5;
  if (suited) score += 1.5;
  if (high - low === 1) score += 1; // connectors
  return Math.max(0, Math.min(10, score));
}

/** Simple deterministic pseudo-random for bot decisions, seeded by hand context. */
function pseudoRandom(...seeds: number[]): number {
  let h = 0xdeadbeef;
  for (const s of seeds) {
    h = Math.imul(h ^ s, 2654435761);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

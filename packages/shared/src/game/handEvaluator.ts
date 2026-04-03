import type { Card, Rank } from '../types/card.js';
import { RANK_VALUES } from '../types/card.js';

export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: 'High Card',
  [HandRank.ONE_PAIR]: 'One Pair',
  [HandRank.TWO_PAIR]: 'Two Pair',
  [HandRank.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandRank.STRAIGHT]: 'Straight',
  [HandRank.FLUSH]: 'Flush',
  [HandRank.FULL_HOUSE]: 'Full House',
  [HandRank.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HandRank.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandRank.ROYAL_FLUSH]: 'Royal Flush',
};

export interface EvaluatedHand {
  rank: HandRank;
  /** Kickers ordered highest first, used for tie-breaking. */
  values: number[];
  /** Human-readable description, e.g. "Full House, Aces over Kings". */
  description: string;
  /** The 5 cards that form the best hand. */
  cards: Card[];
}

/**
 * Evaluate the best 5-card hand from any set of 5–7 cards.
 * Returns the best EvaluatedHand.
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  const combos = combinations(cards, 5);
  let best: EvaluatedHand | null = null;

  for (const combo of combos) {
    const evaluated = evaluate5(combo);
    if (!best || compareHands(evaluated, best) > 0) {
      best = evaluated;
    }
  }

  return best!;
}

/**
 * Compare two evaluated hands. Returns > 0 if a wins, < 0 if b wins, 0 for tie.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < a.values.length; i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

/** Generate all k-length combinations from arr. */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];

  function recurse(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i <= arr.length - (k - current.length); i++) {
      current.push(arr[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }

  recurse(0, []);
  return result;
}

function evaluate5(cards: Card[]): EvaluatedHand {
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(values);
  const isWheel = checkWheel(values);

  const counts = getCountMap(values);
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ value: Number(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (isFlush && isStraight && values[0] === 14) {
    return { rank: HandRank.ROYAL_FLUSH, values: [14], description: 'Royal Flush', cards };
  }

  if (isFlush && isStraight) {
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      values: [values[0]],
      description: `Straight Flush, ${rankName(values[0])}-high`,
      cards,
    };
  }

  // EDGE CASE: wheel straight flush (A-2-3-4-5 all same suit)
  if (isFlush && isWheel) {
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      values: [5],
      description: 'Straight Flush, Five-high',
      cards,
    };
  }

  if (groups[0].count === 4) {
    const kicker = groups.find((g) => g.count !== 4)!.value;
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      values: [groups[0].value, kicker],
      description: `Four of a Kind, ${rankName(groups[0].value)}s`,
      cards,
    };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      rank: HandRank.FULL_HOUSE,
      values: [groups[0].value, groups[1].value],
      description: `Full House, ${rankName(groups[0].value)}s over ${rankName(groups[1].value)}s`,
      cards,
    };
  }

  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      values,
      description: `Flush, ${rankName(values[0])}-high`,
      cards,
    };
  }

  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      values: [values[0]],
      description: `Straight, ${rankName(values[0])}-high`,
      cards,
    };
  }

  // EDGE CASE: wheel straight (A-2-3-4-5)
  if (isWheel) {
    return {
      rank: HandRank.STRAIGHT,
      values: [5],
      description: 'Straight, Five-high',
      cards,
    };
  }

  if (groups[0].count === 3) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.value);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      values: [groups[0].value, ...kickers],
      description: `Three of a Kind, ${rankName(groups[0].value)}s`,
      cards,
    };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups.find((g) => g.count === 1)!.value;
    return {
      rank: HandRank.TWO_PAIR,
      values: [highPair, lowPair, kicker],
      description: `Two Pair, ${rankName(highPair)}s and ${rankName(lowPair)}s`,
      cards,
    };
  }

  if (groups[0].count === 2) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.value);
    return {
      rank: HandRank.ONE_PAIR,
      values: [groups[0].value, ...kickers],
      description: `One Pair, ${rankName(groups[0].value)}s`,
      cards,
    };
  }

  return {
    rank: HandRank.HIGH_CARD,
    values,
    description: `High Card, ${rankName(values[0])}`,
    cards,
  };
}

function checkStraight(sortedDesc: number[]): boolean {
  for (let i = 0; i < sortedDesc.length - 1; i++) {
    if (sortedDesc[i] - sortedDesc[i + 1] !== 1) return false;
  }
  return true;
}

/** Detect A-2-3-4-5 wheel straight (ace plays low). */
function checkWheel(sortedDesc: number[]): boolean {
  const wheelValues = [14, 5, 4, 3, 2];
  return sortedDesc.length === 5 && sortedDesc.every((v, i) => v === wheelValues[i]);
}

function getCountMap(values: number[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const v of values) {
    map[v] = (map[v] || 0) + 1;
  }
  return map;
}

const RANK_NAMES: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

function rankName(value: number): string {
  return RANK_NAMES[value] ?? String(value);
}

import { SUITS, RANKS } from '../types/card.js';
import type { Card } from '../types/card.js';

/** Shuffle function signature — injectable for deterministic testing. */
export type ShuffleFn = (cards: Card[]) => Card[];

/** Fisher-Yates shuffle. Suitable for production; inject a custom fn for tests. */
export function fisherYatesShuffle(cards: Card[]): Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Create an ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Deal hole cards to players from the top of a shuffled deck.
 * Returns [dealtCards (per player), remainingDeck].
 */
export function dealHoleCards(
  deck: Card[],
  numPlayers: number,
  shuffleFn: ShuffleFn,
): [Card[][], Card[]] {
  const shuffled = shuffleFn([...deck]);
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);

  // Deal one card at a time per round (2 rounds) to mimic real dealing
  for (let round = 0; round < 2; round++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p].push(shuffled.shift()!);
    }
  }
  return [hands, shuffled];
}

/** Deal community cards (flop=3, turn=1, river=1) with burn cards. */
export function dealCommunityCards(
  deck: Card[],
  count: 1 | 3,
): [Card[], Card[]] {
  const remaining = [...deck];
  remaining.shift(); // burn
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(remaining.shift()!);
  }
  return [cards, remaining];
}

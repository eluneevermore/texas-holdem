import type { Card, Suit, Rank } from '../../src/types/card.js';

/** Shorthand card constructor: card('A', 'spades') */
export function card(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

/** Parse "As" → Card. s=spades, h=hearts, d=diamonds, c=clubs */
export function c(notation: string): Card {
  const suitMap: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  const suitChar = notation.slice(-1);
  const rankStr = notation.slice(0, -1);
  return { rank: rankStr as Rank, suit: suitMap[suitChar] };
}

/** Parse a space-separated list of card notations. */
export function cards(notation: string): Card[] {
  return notation.split(/\s+/).map(c);
}

/** Deterministic identity shuffle — returns cards in same order. */
export function noShuffle(cards: Card[]): Card[] {
  return [...cards];
}

/** Deterministic reversed shuffle for testing. */
export function reverseShuffle(cards: Card[]): Card[] {
  return [...cards].reverse();
}

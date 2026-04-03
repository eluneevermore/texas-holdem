import { describe, it, expect } from 'vitest';
import { createDeck, dealHoleCards, dealCommunityCards, fisherYatesShuffle } from './deck.js';
import { noShuffle, reverseShuffle } from '../../__tests__/factories/cards.js';

describe('Deck', () => {
  describe('createDeck', () => {
    it('returns 52 unique cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
      const unique = new Set(deck.map((c) => `${c.rank}${c.suit}`));
      expect(unique.size).toBe(52);
    });

    it('contains all four suits', () => {
      const deck = createDeck();
      const suits = new Set(deck.map((c) => c.suit));
      expect(suits).toEqual(new Set(['spades', 'hearts', 'diamonds', 'clubs']));
    });

    it('contains all thirteen ranks', () => {
      const deck = createDeck();
      const ranks = new Set(deck.map((c) => c.rank));
      expect(ranks.size).toBe(13);
    });
  });

  describe('dealHoleCards', () => {
    it('deals 2 cards per player', () => {
      const deck = createDeck();
      const [hands, remaining] = dealHoleCards(deck, 3, noShuffle);
      expect(hands).toHaveLength(3);
      for (const hand of hands) {
        expect(hand).toHaveLength(2);
      }
      expect(remaining).toHaveLength(52 - 6);
    });

    it('uses the injectable shuffle function', () => {
      const deck = createDeck();
      const [handsA] = dealHoleCards(deck, 2, noShuffle);
      const [handsB] = dealHoleCards(deck, 2, reverseShuffle);
      expect(handsA).not.toEqual(handsB);
    });

    it('deals cards round-robin (not sequentially)', () => {
      const deck = createDeck();
      const [hands] = dealHoleCards(deck, 2, noShuffle);
      // With no shuffle, first card goes to player 0, second to player 1, etc.
      expect(hands[0][0]).toEqual(deck[0]);
      expect(hands[1][0]).toEqual(deck[1]);
      expect(hands[0][1]).toEqual(deck[2]);
      expect(hands[1][1]).toEqual(deck[3]);
    });
  });

  describe('dealCommunityCards', () => {
    it('deals 3 cards for the flop after burning one', () => {
      const deck = createDeck();
      const [cards, remaining] = dealCommunityCards(deck, 3);
      expect(cards).toHaveLength(3);
      // First card was burned, so flop starts at index 1
      expect(cards[0]).toEqual(deck[1]);
      expect(cards[1]).toEqual(deck[2]);
      expect(cards[2]).toEqual(deck[3]);
      expect(remaining).toHaveLength(52 - 4);
    });

    it('deals 1 card for turn/river after burning one', () => {
      const deck = createDeck();
      const [cards, remaining] = dealCommunityCards(deck, 1);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toEqual(deck[1]);
      expect(remaining).toHaveLength(52 - 2);
    });
  });

  describe('fisherYatesShuffle', () => {
    it('returns all 52 cards', () => {
      const deck = createDeck();
      const shuffled = fisherYatesShuffle(deck);
      expect(shuffled).toHaveLength(52);
      const origSet = new Set(deck.map((c) => `${c.rank}${c.suit}`));
      const shuffSet = new Set(shuffled.map((c) => `${c.rank}${c.suit}`));
      expect(shuffSet).toEqual(origSet);
    });

    it('does not mutate the original array', () => {
      const deck = createDeck();
      const copy = [...deck];
      fisherYatesShuffle(deck);
      expect(deck).toEqual(copy);
    });
  });
});

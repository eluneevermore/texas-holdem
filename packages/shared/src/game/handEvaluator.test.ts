import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands, HandRank } from './handEvaluator.js';
import { cards } from '../../__tests__/factories/cards.js';

describe('evaluateHand', () => {
  describe('hand rankings', () => {
    it('identifies a royal flush', () => {
      const result = evaluateHand(cards('As Ks Qs Js 10s'));
      expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
    });

    it('identifies a straight flush', () => {
      const result = evaluateHand(cards('9h 8h 7h 6h 5h'));
      expect(result.rank).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('identifies four of a kind', () => {
      const result = evaluateHand(cards('Ks Kh Kd Kc 3s'));
      expect(result.rank).toBe(HandRank.FOUR_OF_A_KIND);
    });

    it('identifies a full house', () => {
      const result = evaluateHand(cards('As Ah Ad Ks Kh'));
      expect(result.rank).toBe(HandRank.FULL_HOUSE);
      expect(result.description).toContain('Aces over Kings');
    });

    it('identifies a flush', () => {
      const result = evaluateHand(cards('As 10s 7s 4s 2s'));
      expect(result.rank).toBe(HandRank.FLUSH);
    });

    it('identifies a straight', () => {
      const result = evaluateHand(cards('9s 8h 7d 6c 5s'));
      expect(result.rank).toBe(HandRank.STRAIGHT);
    });

    it('identifies three of a kind', () => {
      const result = evaluateHand(cards('7s 7h 7d Ks 2c'));
      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
    });

    it('identifies two pair', () => {
      const result = evaluateHand(cards('As Ah 5s 5d Kc'));
      expect(result.rank).toBe(HandRank.TWO_PAIR);
    });

    it('identifies one pair', () => {
      const result = evaluateHand(cards('Js Jh 9d 5c 2s'));
      expect(result.rank).toBe(HandRank.ONE_PAIR);
    });

    it('identifies high card', () => {
      const result = evaluateHand(cards('As Kh 9d 5c 2s'));
      expect(result.rank).toBe(HandRank.HIGH_CARD);
    });
  });

  describe('edge cases', () => {
    it('handles the wheel straight (A-2-3-4-5)', () => {
      const result = evaluateHand(cards('As 2h 3d 4c 5s'));
      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.values).toEqual([5]); // Five-high straight
    });

    it('handles ace-high Broadway straight', () => {
      const result = evaluateHand(cards('As Kh Qd Jc 10s'));
      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.values).toEqual([14]);
    });

    it('handles wheel straight flush', () => {
      const result = evaluateHand(cards('Ah 2h 3h 4h 5h'));
      expect(result.rank).toBe(HandRank.STRAIGHT_FLUSH);
      expect(result.values).toEqual([5]);
    });

    it('picks the best 5-card hand from 7 cards', () => {
      // Hole: As Ks, Community: Qs Js 10s 2h 3d → Royal Flush
      const result = evaluateHand(cards('As Ks Qs Js 10s 2h 3d'));
      expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
    });

    it('picks the best hand when multiple good options exist', () => {
      // Has both a flush and a straight available, should pick flush
      const result = evaluateHand(cards('As Ks 9s 7s 3s 8h 6d'));
      expect(result.rank).toBe(HandRank.FLUSH);
    });
  });

  describe('tiebreaking', () => {
    it('breaks a tie between two flushes by high card', () => {
      const a = evaluateHand(cards('As Ks 9s 7s 3s'));
      const b = evaluateHand(cards('Kh Qh 9h 7h 3h'));
      expect(compareHands(a, b)).toBeGreaterThan(0);
    });

    it('breaks a tie between two pairs by kicker', () => {
      const a = evaluateHand(cards('As Ah Ks 5d 3c'));
      const b = evaluateHand(cards('Ad Ac Qs 5h 3s'));
      expect(compareHands(a, b)).toBeGreaterThan(0);
    });

    it('returns a split when hands are exactly equal', () => {
      const a = evaluateHand(cards('As Kh Qd Jc 10s'));
      const b = evaluateHand(cards('Ad Kc Qs Jh 10d'));
      expect(compareHands(a, b)).toBe(0);
    });

    it('breaks tie between full houses by triple rank', () => {
      const a = evaluateHand(cards('As Ah Ad 3s 3h'));
      const b = evaluateHand(cards('Ks Kh Kd Qs Qh'));
      expect(compareHands(a, b)).toBeGreaterThan(0);
    });

    it('breaks tie between two two-pairs by higher pair', () => {
      const a = evaluateHand(cards('Ks Kh 5s 5d 2c'));
      const b = evaluateHand(cards('Qs Qh Js Jd Ac'));
      expect(compareHands(a, b)).toBeGreaterThan(0);
    });
  });
});

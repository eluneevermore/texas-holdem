import { describe, it, expect } from 'vitest';
import { normalStrategy } from './normal.js';
import { makeBotState } from '../../../__tests__/factories/botState.js';

describe('normalStrategy', () => {
  describe('pre-flop', () => {
    it('returns a valid action for premium hands', () => {
      const state = makeBotState({
        botHoleCards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'A', suit: 'hearts' },
        ],
      });
      const decision = normalStrategy(state);
      expect(['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN']).toContain(decision.action);
    });

    it('returns a valid action for weak hands', () => {
      const state = makeBotState({
        botHoleCards: [
          { rank: '2', suit: 'spades' },
          { rank: '7', suit: 'hearts' },
        ],
      });
      const decision = normalStrategy(state);
      expect(['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN']).toContain(decision.action);
    });

    it('never returns invalid action types', () => {
      const validActions = new Set(['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN']);
      for (let i = 0; i < 50; i++) {
        const state = makeBotState({ handNumber: i });
        const decision = normalStrategy(state);
        expect(validActions.has(decision.action)).toBe(true);
      }
    });

    it('distribution: raises at least sometimes with premium hands over many runs', () => {
      let raiseCount = 0;
      for (let i = 0; i < 100; i++) {
        const state = makeBotState({
          handNumber: i,
          botHoleCards: [
            { rank: 'A', suit: 'spades' },
            { rank: 'K', suit: 'spades' },
          ],
        });
        if (normalStrategy(state).action === 'RAISE') raiseCount++;
      }
      expect(raiseCount).toBeGreaterThan(5);
    });
  });

  describe('post-flop', () => {
    it('considers community cards when deciding', () => {
      const state = makeBotState({
        phase: 'FLOP',
        communityCards: [
          { rank: 'A', suit: 'diamonds' },
          { rank: 'K', suit: 'diamonds' },
          { rank: 'Q', suit: 'clubs' },
        ],
        currentBet: 0,
        botCurrentBet: 0,
        callAmount: 0,
      });
      const decision = normalStrategy(state);
      expect(['CHECK', 'RAISE', 'ALL_IN']).toContain(decision.action);
    });

    it('folds weak hands to large bets', () => {
      let foldCount = 0;
      for (let i = 0; i < 100; i++) {
        const state = makeBotState({
          handNumber: i,
          phase: 'RIVER',
          botHoleCards: [
            { rank: '2', suit: 'spades' },
            { rank: '7', suit: 'hearts' },
          ],
          communityCards: [
            { rank: 'K', suit: 'diamonds' },
            { rank: 'Q', suit: 'clubs' },
            { rank: 'J', suit: 'hearts' },
            { rank: '9', suit: 'spades' },
            { rank: '6', suit: 'diamonds' },
          ],
          currentBet: 200,
          botCurrentBet: 0,
          callAmount: 200,
        });
        if (normalStrategy(state).action === 'FOLD') foldCount++;
      }
      expect(foldCount).toBeGreaterThan(50);
    });
  });
});

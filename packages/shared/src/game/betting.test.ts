import { describe, it, expect } from 'vitest';
import { getAvailableActions, validateAction } from './betting.js';
import { ActionType } from '../types/game.js';
import type { BettingContext } from './betting.js';

function makeCtx(overrides: Partial<BettingContext> = {}): BettingContext {
  return {
    currentBet: 20,
    playerCurrentBet: 0,
    playerChips: 1000,
    lastRaiseSize: 20,
    hasActed: false,
    facesFullRaise: false,
    isBigBlindOption: false,
    ...overrides,
  };
}

describe('getAvailableActions', () => {
  it('allows check when no outstanding bet', () => {
    const actions = getAvailableActions(makeCtx({ currentBet: 0, playerCurrentBet: 0 }));
    expect(actions.canCheck).toBe(true);
    expect(actions.canCall).toBe(false);
  });

  it('allows call when there is an outstanding bet', () => {
    const actions = getAvailableActions(makeCtx());
    expect(actions.canCheck).toBe(false);
    expect(actions.canCall).toBe(true);
    expect(actions.callAmount).toBe(20);
  });

  it('caps call amount to player chips', () => {
    const actions = getAvailableActions(makeCtx({ playerChips: 10 }));
    expect(actions.callAmount).toBe(10);
  });

  it('allows raise when not blocked by sub-minimum all-in', () => {
    const actions = getAvailableActions(makeCtx());
    expect(actions.canRaise).toBe(true);
    expect(actions.minRaiseTotal).toBe(40); // 20 + 20
  });

  it('blocks raise when player has acted and faces only sub-minimum all-in', () => {
    const actions = getAvailableActions(makeCtx({ hasActed: true, facesFullRaise: false }));
    expect(actions.canRaise).toBe(false);
  });

  it('allows raise when player has acted but faces a full raise', () => {
    const actions = getAvailableActions(makeCtx({ hasActed: true, facesFullRaise: true }));
    expect(actions.canRaise).toBe(true);
  });
});

describe('validateAction', () => {
  it('validates a fold', () => {
    const result = validateAction({ type: ActionType.FOLD }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.type).toBe(ActionType.FOLD);
  });

  it('rejects check when there is a bet', () => {
    const result = validateAction({ type: ActionType.CHECK }, makeCtx());
    expect(result.ok).toBe(false);
  });

  it('validates check when no bet', () => {
    const result = validateAction(
      { type: ActionType.CHECK },
      makeCtx({ currentBet: 0, playerCurrentBet: 0 }),
    );
    expect(result.ok).toBe(true);
  });

  it('validates a call', () => {
    const result = validateAction({ type: ActionType.CALL }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(ActionType.CALL);
      expect(result.value.amount).toBe(20);
    }
  });

  it('converts call to all-in when chips are insufficient', () => {
    const result = validateAction({ type: ActionType.CALL }, makeCtx({ playerChips: 10 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(ActionType.ALL_IN);
      expect(result.value.amount).toBe(10);
    }
  });

  it('validates a raise with specified amount', () => {
    const result = validateAction({ type: ActionType.RAISE, amount: 60 }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(ActionType.RAISE);
      expect(result.value.amount).toBe(60); // cost = 60 - 0
    }
  });

  it('rejects a raise below minimum', () => {
    const result = validateAction({ type: ActionType.RAISE, amount: 25 }, makeCtx());
    expect(result.ok).toBe(false);
  });

  it('rejects a raise above max', () => {
    const result = validateAction({ type: ActionType.RAISE, amount: 2000 }, makeCtx());
    expect(result.ok).toBe(false);
  });

  it('converts raise at max to all-in', () => {
    const result = validateAction({ type: ActionType.RAISE, amount: 1000 }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(ActionType.ALL_IN);
    }
  });

  it('validates all-in', () => {
    const result = validateAction({ type: ActionType.ALL_IN }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(ActionType.ALL_IN);
      expect(result.value.amount).toBe(1000);
    }
  });

  it('rejects all-in with 0 chips', () => {
    const result = validateAction({ type: ActionType.ALL_IN }, makeCtx({ playerChips: 0 }));
    expect(result.ok).toBe(false);
  });
});

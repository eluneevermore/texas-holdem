import { describe, it, expect } from 'vitest';
import { calculatePots, awardPots } from './pot.js';
import type { PotContributor } from './pot.js';

describe('calculatePots', () => {
  it('creates a single main pot when no one is all-in', () => {
    const contributors: PotContributor[] = [
      { playerId: 'p1', totalBet: 100, isEligible: true },
      { playerId: 'p2', totalBet: 100, isEligible: true },
      { playerId: 'p3', totalBet: 100, isEligible: true },
    ];
    const pots = calculatePots(contributors);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('creates a main pot and a side pot on single all-in', () => {
    const contributors: PotContributor[] = [
      { playerId: 'p1', totalBet: 50, isEligible: true },   // all-in
      { playerId: 'p2', totalBet: 100, isEligible: true },
      { playerId: 'p3', totalBet: 100, isEligible: true },
    ];
    const pots = calculatePots(contributors);
    expect(pots).toHaveLength(2);
    // Main pot: 50 × 3 = 150
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);
    // Side pot: 50 × 2 = 100
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligiblePlayerIds).toEqual(['p2', 'p3']);
  });

  it('creates multiple side pots for multiple all-ins at different levels', () => {
    const contributors: PotContributor[] = [
      { playerId: 'p1', totalBet: 30, isEligible: true },
      { playerId: 'p2', totalBet: 70, isEligible: true },
      { playerId: 'p3', totalBet: 100, isEligible: true },
      { playerId: 'p4', totalBet: 100, isEligible: true },
    ];
    const pots = calculatePots(contributors);
    expect(pots).toHaveLength(3);
    // Main: 30 × 4 = 120
    expect(pots[0].amount).toBe(120);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3', 'p4']);
    // Side 1: 40 × 3 = 120 (70-30 from p2,p3,p4)
    expect(pots[1].amount).toBe(120);
    expect(pots[1].eligiblePlayerIds).toEqual(['p2', 'p3', 'p4']);
    // Side 2: 30 × 2 = 60 (100-70 from p3,p4)
    expect(pots[2].amount).toBe(60);
    expect(pots[2].eligiblePlayerIds).toEqual(['p3', 'p4']);
  });

  it('excludes folded players from pot eligibility', () => {
    const contributors: PotContributor[] = [
      { playerId: 'p1', totalBet: 100, isEligible: false }, // folded
      { playerId: 'p2', totalBet: 100, isEligible: true },
      { playerId: 'p3', totalBet: 100, isEligible: true },
    ];
    const pots = calculatePots(contributors);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300); // folded player's chips still in pot
    expect(pots[0].eligiblePlayerIds).toEqual(['p2', 'p3']);
  });

  it('returns empty array when no contributions', () => {
    expect(calculatePots([])).toEqual([]);
  });
});

describe('awardPots', () => {
  it('awards the single pot to the sole winner', () => {
    const pots = [{ amount: 300, eligiblePlayerIds: ['p1', 'p2', 'p3'] }];
    const seatMap = new Map([['p1', 0], ['p2', 1], ['p3', 2]]);
    const awards = awardPots(pots, () => ['p1'], 0, seatMap);
    expect(awards).toHaveLength(1);
    expect(awards[0]).toEqual({ playerId: 'p1', potIndex: 0, amount: 300 });
  });

  it('splits the pot equally and gives odd chip to player left of dealer', () => {
    const pots = [{ amount: 301, eligiblePlayerIds: ['p1', 'p2'] }];
    const seatMap = new Map([['p1', 1], ['p2', 2]]);
    const awards = awardPots(pots, () => ['p1', 'p2'], 0, seatMap);
    expect(awards).toHaveLength(2);
    // p1 (seat 1) is closer left of dealer (seat 0) → gets the odd chip
    const p1Award = awards.find((a) => a.playerId === 'p1')!;
    const p2Award = awards.find((a) => a.playerId === 'p2')!;
    expect(p1Award.amount).toBe(151);
    expect(p2Award.amount).toBe(150);
  });

  it('awards side pots only to eligible winners', () => {
    const pots = [
      { amount: 150, eligiblePlayerIds: ['p1', 'p2', 'p3'] },
      { amount: 100, eligiblePlayerIds: ['p2', 'p3'] },
    ];
    const seatMap = new Map([['p1', 0], ['p2', 1], ['p3', 2]]);
    const awards = awardPots(
      pots,
      (eligible) => (eligible.includes('p1') ? ['p1'] : ['p2']),
      0,
      seatMap,
    );
    expect(awards).toHaveLength(2);
    expect(awards[0]).toEqual({ playerId: 'p1', potIndex: 0, amount: 150 });
    expect(awards[1]).toEqual({ playerId: 'p2', potIndex: 1, amount: 100 });
  });
});

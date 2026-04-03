import type { Pot } from '../types/game.js';

export interface PotContributor {
  playerId: string;
  /** Total chips this player has put in across all rounds. */
  totalBet: number;
  /** Whether the player is still eligible (not folded). */
  isEligible: boolean;
}

/**
 * Calculate main pot and side pots from player contributions.
 * Pots are returned ordered smallest (innermost) first, suitable for showdown resolution.
 */
export function calculatePots(contributors: PotContributor[]): Pot[] {
  const eligible = contributors.filter((c) => c.totalBet > 0);
  if (eligible.length === 0) return [];

  // Get unique sorted bet levels from all-in players + max bet
  const betLevels = [...new Set(eligible.map((c) => c.totalBet))].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let prevLevel = 0;

  for (const level of betLevels) {
    const increment = level - prevLevel;
    if (increment <= 0) continue;

    let amount = 0;
    const eligiblePlayerIds: string[] = [];

    for (const c of eligible) {
      if (c.totalBet > prevLevel) {
        // This player contributes to this pot tier
        const contribution = Math.min(c.totalBet - prevLevel, increment);
        amount += contribution;
      }
      if (c.totalBet >= level && c.isEligible) {
        eligiblePlayerIds.push(c.playerId);
      }
    }

    if (amount > 0) {
      pots.push({ amount, eligiblePlayerIds });
    }
    prevLevel = level;
  }

  return pots;
}

/**
 * Award pots at showdown. Processes smallest pot first (innermost), then outward.
 * Takes a ranking function that, given a list of player IDs, returns the winner IDs (may be >1 for splits).
 * Returns an array of { playerId, potIndex, amount }.
 */
export function awardPots(
  pots: Pot[],
  getWinners: (eligiblePlayerIds: string[]) => string[],
  dealerSeatIndex: number,
  seatIndexMap: Map<string, number>,
): { playerId: string; potIndex: number; amount: number }[] {
  const awards: { playerId: string; potIndex: number; amount: number }[] = [];

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    if (pot.eligiblePlayerIds.length === 0) continue;

    const winners = getWinners(pot.eligiblePlayerIds);
    if (winners.length === 0) continue;

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    // Odd chip goes to the winner closest to left of dealer
    const sortedWinners = [...winners].sort((a, b) => {
      const seatA = seatIndexMap.get(a) ?? 0;
      const seatB = seatIndexMap.get(b) ?? 0;
      return clockwiseDistance(dealerSeatIndex, seatA) - clockwiseDistance(dealerSeatIndex, seatB);
    });

    for (let w = 0; w < sortedWinners.length; w++) {
      const extra = w === 0 ? remainder : 0;
      awards.push({
        playerId: sortedWinners[w],
        potIndex: i,
        amount: share + extra,
      });
    }
  }

  return awards;
}

function clockwiseDistance(from: number, to: number): number {
  const maxSeats = 9;
  return (to - from + maxSeats) % maxSeats || maxSeats;
}

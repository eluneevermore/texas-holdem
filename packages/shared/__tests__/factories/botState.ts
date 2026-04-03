import type { BotGameState, BotOpponent } from '../../src/bot/types.js';
import type { Card, Pot } from '../../src/types/index.js';

export function makeBotState(overrides: Partial<BotGameState> = {}): BotGameState {
  return {
    botPlayerId: 'bot-1',
    botSeatIndex: 0,
    botHoleCards: [
      { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'spades' },
    ],
    botChips: 1000,
    phase: 'PRE_FLOP',
    communityCards: [],
    pots: [{ amount: 30, eligiblePlayerIds: ['bot-1', 'p2'] }],
    currentBet: 20,
    botCurrentBet: 10,
    callAmount: 10,
    minRaiseAmount: 40,
    maxRaiseAmount: 1000,
    opponents: [makeOpponent()],
    dealerSeatIndex: 0,
    handNumber: 1,
    ...overrides,
  };
}

export function makeOpponent(overrides: Partial<BotOpponent> = {}): BotOpponent {
  return {
    playerId: 'p2',
    seatIndex: 1,
    chips: 1000,
    currentBet: 20,
    handState: 'ACTIVE',
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: true,
    ...overrides,
  };
}

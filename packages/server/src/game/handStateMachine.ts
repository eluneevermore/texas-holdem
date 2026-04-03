import {
  type Card, type Pot, type RoomPlayer,
  HandPhase, HandState, ActionType, PlayerState,
  createDeck, fisherYatesShuffle, dealHoleCards, dealCommunityCards,
  evaluateHand, compareHands, calculatePots, awardPots,
  getAvailableActions, validateAction,
  type BettingContext, type PotContributor, type EvaluatedHand,
  TURN_TIMER_SECONDS,
} from '@poker/shared';
import type { ShuffleFn } from '@poker/shared';

export interface HandPlayerState {
  playerId: string;
  seatIndex: number;
  holeCards: Card[];
  chips: number;
  chipsAtStart: number;
  currentRoundBet: number;
  totalBet: number;
  handState: HandState;
  hasActedThisRound: boolean;
  consecutiveTimeouts: number;
  lastAction: { type: ActionType; amount: number } | null;
}

export interface HandContext {
  handId: string;
  roomId: string;
  handNumber: number;
  dealerSeatIndex: number;
  dealerArrayIndex: number;
  phase: HandPhase;
  communityCards: Card[];
  deck: Card[];
  players: HandPlayerState[];
  currentBet: number;
  lastRaiseSize: number;
  activePlayerIndex: number;
  lastAggressorIndex: number;
  roundStartIndex: number;
  pots: Pot[];
  smallBlind: number;
  bigBlind: number;
}

export interface ActionResult {
  type: ActionType;
  amount: number;
  playerId: string;
  isAllIn: boolean;
  newPhase?: HandPhase;
  showdownResults?: ShowdownResult[];
  winners?: WinnerResult[];
  newCommunityCards?: Card[];
  updatedPots?: Pot[];
}

export interface ShowdownResult {
  playerId: string;
  holeCards: Card[];
  handRank: string;
  mucked: boolean;
}

export interface WinnerResult {
  playerId: string;
  potIndex: number;
  amount: number;
  handRank?: string;
}

/**
 * Create a new hand context and deal cards.
 * Accepts an optional shuffle function for deterministic testing.
 */
export function startHand(
  handId: string,
  roomId: string,
  handNumber: number,
  activePlayers: RoomPlayer[],
  dealerSeatIndex: number,
  smallBlind: number,
  bigBlind: number,
  shuffleFn: ShuffleFn = fisherYatesShuffle,
): HandContext {
  const sorted = [...activePlayers].sort((a, b) => a.seatIndex - b.seatIndex);

  const deck = createDeck();
  const [holeCardSets, remainingDeck] = dealHoleCards(deck, sorted.length, shuffleFn);

  const players: HandPlayerState[] = sorted.map((p, i) => ({
    playerId: p.playerId,
    seatIndex: p.seatIndex,
    holeCards: holeCardSets[i],
    chips: p.chips,
    chipsAtStart: p.chips,
    currentRoundBet: 0,
    totalBet: 0,
    handState: HandState.ACTIVE,
    hasActedThisRound: false,
    consecutiveTimeouts: 0,
    lastAction: null,
  }));

  const dealerArrayIndex = players.findIndex((p) => p.seatIndex === dealerSeatIndex);
  if (dealerArrayIndex === -1) {
    throw new Error(`Dealer seat ${dealerSeatIndex} not found among active players`);
  }

  const ctx: HandContext = {
    handId,
    roomId,
    handNumber,
    dealerSeatIndex,
    dealerArrayIndex,
    phase: HandPhase.PRE_FLOP,
    communityCards: [],
    deck: remainingDeck,
    players,
    currentBet: 0,
    lastRaiseSize: bigBlind,
    activePlayerIndex: 0,
    lastAggressorIndex: -1,
    roundStartIndex: 0,
    pots: [],
    smallBlind,
    bigBlind,
  };

  postBlinds(ctx);
  return ctx;
}

function postBlinds(ctx: HandContext) {
  const n = ctx.players.length;
  const isHeadsUp = n === 2;

  let sbIdx: number;
  let bbIdx: number;

  if (isHeadsUp) {
    // EDGE CASE: Heads-up — dealer posts SB, other posts BB
    sbIdx = ctx.dealerArrayIndex;
    bbIdx = (ctx.dealerArrayIndex + 1) % n;
  } else {
    sbIdx = (ctx.dealerArrayIndex + 1) % n;
    bbIdx = (ctx.dealerArrayIndex + 2) % n;
  }

  postBlind(ctx, sbIdx, ctx.smallBlind);
  postBlind(ctx, bbIdx, ctx.bigBlind);

  ctx.currentBet = ctx.bigBlind;

  // Pre-flop: action starts left of BB (UTG)
  const utgIdx = (bbIdx + 1) % n;
  ctx.activePlayerIndex = utgIdx;
  ctx.roundStartIndex = utgIdx;
}

function postBlind(ctx: HandContext, playerIdx: number, amount: number) {
  const player = ctx.players[playerIdx];
  if (!player) {
    throw new Error(`Cannot post blind: no player at index ${playerIdx} (${ctx.players.length} players)`);
  }
  const actual = Math.min(amount, player.chips);
  player.chips -= actual;
  player.currentRoundBet = actual;
  player.totalBet = actual;

  // EDGE CASE: player goes all-in posting a blind
  if (player.chips === 0) {
    player.handState = HandState.ALL_IN;
  }
}

/**
 * Get the currently active player (whose turn it is).
 */
export function getActivePlayer(ctx: HandContext): HandPlayerState | null {
  if (ctx.phase === HandPhase.SHOWDOWN || ctx.phase === HandPhase.COMPLETE) return null;
  return ctx.players[ctx.activePlayerIndex] ?? null;
}

/**
 * Get available actions for the active player.
 */
export function getActivePlayerActions(ctx: HandContext) {
  const player = getActivePlayer(ctx);
  if (!player) return null;

  const bettingCtx: BettingContext = {
    currentBet: ctx.currentBet,
    playerCurrentBet: player.currentRoundBet,
    playerChips: player.chips,
    lastRaiseSize: ctx.lastRaiseSize,
    hasActed: player.hasActedThisRound,
    facesFullRaise: !player.hasActedThisRound || ctx.lastRaiseSize >= ctx.bigBlind,
    isBigBlindOption: false,
  };

  return { player, actions: getAvailableActions(bettingCtx), bettingCtx };
}

/**
 * Process a player action. Returns the result including any phase changes.
 */
export function processAction(
  ctx: HandContext,
  playerId: string,
  actionInput: { type: ActionType; amount?: number },
): ActionResult | { error: string } {
  const active = getActivePlayer(ctx);
  if (!active || active.playerId !== playerId) {
    return { error: 'Not your turn' };
  }

  const bettingCtx: BettingContext = {
    currentBet: ctx.currentBet,
    playerCurrentBet: active.currentRoundBet,
    playerChips: active.chips,
    lastRaiseSize: ctx.lastRaiseSize,
    hasActed: active.hasActedThisRound,
    facesFullRaise: !active.hasActedThisRound || ctx.lastRaiseSize >= ctx.bigBlind,
    isBigBlindOption: false,
  };

  const validation = validateAction(actionInput, bettingCtx);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const action = validation.value;
  return applyAction(ctx, active, action);
}

function applyAction(
  ctx: HandContext,
  player: HandPlayerState,
  action: { type: ActionType; amount: number },
): ActionResult {
  const result: ActionResult = {
    type: action.type,
    amount: action.amount,
    playerId: player.playerId,
    isAllIn: false,
  };

  switch (action.type) {
    case ActionType.FOLD:
      player.handState = HandState.FOLDED;
      break;

    case ActionType.CHECK:
      break;

    case ActionType.CALL:
      player.chips -= action.amount;
      player.currentRoundBet += action.amount;
      player.totalBet += action.amount;
      break;

    case ActionType.RAISE: {
      const raiseTotal = player.currentRoundBet + action.amount;
      const raiseBy = raiseTotal - ctx.currentBet;
      ctx.lastRaiseSize = Math.max(raiseBy, ctx.lastRaiseSize);
      ctx.currentBet = raiseTotal;
      ctx.lastAggressorIndex = ctx.activePlayerIndex;

      player.chips -= action.amount;
      player.currentRoundBet = raiseTotal;
      player.totalBet += action.amount;

      for (const p of ctx.players) {
        if (p.playerId !== player.playerId && p.handState === HandState.ACTIVE) {
          p.hasActedThisRound = false;
        }
      }
      break;
    }

    case ActionType.ALL_IN: {
      const allInTotal = player.currentRoundBet + action.amount;
      if (allInTotal > ctx.currentBet) {
        const raiseBy = allInTotal - ctx.currentBet;
        if (raiseBy >= ctx.lastRaiseSize) {
          ctx.lastRaiseSize = raiseBy;
          for (const p of ctx.players) {
            if (p.playerId !== player.playerId && p.handState === HandState.ACTIVE) {
              p.hasActedThisRound = false;
            }
          }
        }
        ctx.lastAggressorIndex = ctx.activePlayerIndex;
        ctx.currentBet = allInTotal;
      }
      player.chips -= action.amount;
      player.currentRoundBet = allInTotal;
      player.totalBet += action.amount;
      player.handState = HandState.ALL_IN;
      result.isAllIn = true;
      break;
    }
  }

  player.hasActedThisRound = true;
  player.lastAction = { type: action.type, amount: action.amount };

  const activePlayers = ctx.players.filter((p) => p.handState !== HandState.FOLDED);
  if (activePlayers.length === 1) {
    return finishHandByFold(ctx, activePlayers[0], result);
  }

  if (isBettingRoundComplete(ctx)) {
    return advancePhase(ctx, result);
  }

  advanceToNextPlayer(ctx);
  return result;
}

function isBettingRoundComplete(ctx: HandContext): boolean {
  const activePlayers = ctx.players.filter(
    (p) => p.handState === HandState.ACTIVE,
  );

  return activePlayers.every(
    (p) => p.hasActedThisRound && p.currentRoundBet === ctx.currentBet,
  );
}

function advanceToNextPlayer(ctx: HandContext): void {
  const n = ctx.players.length;
  let next = (ctx.activePlayerIndex + 1) % n;

  for (let i = 0; i < n; i++) {
    const p = ctx.players[next];
    if (p.handState === HandState.ACTIVE) {
      ctx.activePlayerIndex = next;
      return;
    }
    next = (next + 1) % n;
  }
}

function advancePhase(ctx: HandContext, result: ActionResult): ActionResult {
  updatePots(ctx);

  for (const p of ctx.players) {
    p.currentRoundBet = 0;
    p.hasActedThisRound = false;
  }
  ctx.currentBet = 0;
  ctx.lastRaiseSize = ctx.bigBlind;

  const canAct = ctx.players.filter((p) => p.handState === HandState.ACTIVE);

  if (canAct.length <= 1) {
    runOutBoard(ctx);
    return resolveShowdown(ctx, result);
  }

  switch (ctx.phase) {
    case HandPhase.PRE_FLOP: {
      ctx.phase = HandPhase.FLOP;
      const [cards, remaining] = dealCommunityCards(ctx.deck, 3);
      ctx.communityCards.push(...cards);
      ctx.deck = remaining;
      result.newCommunityCards = cards;
      break;
    }
    case HandPhase.FLOP: {
      ctx.phase = HandPhase.TURN;
      const [cards, remaining] = dealCommunityCards(ctx.deck, 1);
      ctx.communityCards.push(...cards);
      ctx.deck = remaining;
      result.newCommunityCards = cards;
      break;
    }
    case HandPhase.TURN: {
      ctx.phase = HandPhase.RIVER;
      const [cards, remaining] = dealCommunityCards(ctx.deck, 1);
      ctx.communityCards.push(...cards);
      ctx.deck = remaining;
      result.newCommunityCards = cards;
      break;
    }
    case HandPhase.RIVER:
      return resolveShowdown(ctx, result);
    default:
      break;
  }

  result.newPhase = ctx.phase;

  setPostFlopActionOrder(ctx);

  return result;
}

function setPostFlopActionOrder(ctx: HandContext) {
  const n = ctx.players.length;
  let idx = (ctx.dealerArrayIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (ctx.players[idx].handState === HandState.ACTIVE) {
      ctx.activePlayerIndex = idx;
      ctx.roundStartIndex = idx;
      return;
    }
    idx = (idx + 1) % n;
  }
}

function runOutBoard(ctx: HandContext) {
  while (ctx.communityCards.length < 5) {
    const count: 1 | 3 = ctx.communityCards.length === 0 ? 3 : 1;
    const [cards, remaining] = dealCommunityCards(ctx.deck, count);
    ctx.communityCards.push(...cards);
    ctx.deck = remaining;
  }
}

function updatePots(ctx: HandContext) {
  const contributors: PotContributor[] = ctx.players.map((p) => ({
    playerId: p.playerId,
    totalBet: p.totalBet,
    isEligible: p.handState !== HandState.FOLDED,
  }));
  ctx.pots = calculatePots(contributors);
}

function finishHandByFold(
  ctx: HandContext,
  winner: HandPlayerState,
  result: ActionResult,
): ActionResult {
  updatePots(ctx);
  ctx.phase = HandPhase.COMPLETE;
  result.newPhase = HandPhase.COMPLETE;

  const totalWon = ctx.pots.reduce((sum, p) => sum + p.amount, 0);
  winner.chips += totalWon;

  result.winners = [{
    playerId: winner.playerId,
    potIndex: 0,
    amount: totalWon,
  }];
  result.updatedPots = ctx.pots;

  return result;
}

function resolveShowdown(ctx: HandContext, result: ActionResult): ActionResult {
  updatePots(ctx);
  ctx.phase = HandPhase.SHOWDOWN;

  const nonFolded = ctx.players.filter((p) => p.handState !== HandState.FOLDED);
  const evaluations = new Map<string, EvaluatedHand>();

  for (const p of nonFolded) {
    const allCards = [...p.holeCards, ...ctx.communityCards];
    evaluations.set(p.playerId, evaluateHand(allCards));
  }

  const seatMap = new Map(ctx.players.map((p) => [p.playerId, p.seatIndex]));

  const getWinners = (eligible: string[]): string[] => {
    if (eligible.length === 0) return [];
    if (eligible.length === 1) return eligible;

    let best: EvaluatedHand | null = null;
    let winners: string[] = [];

    for (const id of eligible) {
      const hand = evaluations.get(id);
      if (!hand) continue;
      if (!best) {
        best = hand;
        winners = [id];
        continue;
      }
      const cmp = compareHands(hand, best);
      if (cmp > 0) {
        best = hand;
        winners = [id];
      } else if (cmp === 0) {
        winners.push(id);
      }
    }
    return winners;
  };

  const awards = awardPots(ctx.pots, getWinners, ctx.dealerSeatIndex, seatMap);

  for (const award of awards) {
    const player = ctx.players.find((p) => p.playerId === award.playerId);
    if (player) player.chips += award.amount;
  }

  result.showdownResults = nonFolded.map((p) => ({
    playerId: p.playerId,
    holeCards: p.holeCards,
    handRank: evaluations.get(p.playerId)?.description ?? 'Unknown',
    mucked: false,
  }));

  result.winners = awards.map((a) => ({
    ...a,
    handRank: evaluations.get(a.playerId)?.description,
  }));

  result.newPhase = HandPhase.SHOWDOWN;
  result.updatedPots = ctx.pots;
  ctx.phase = HandPhase.COMPLETE;

  return result;
}

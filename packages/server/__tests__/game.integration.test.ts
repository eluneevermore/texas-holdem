import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlayerState, RoomState, HandPhase, ActionType,
  DEFAULT_ROOM_CONFIG,
} from '@poker/shared';
import type { RoomPlayer } from '@poker/shared';
import { roomManager } from '../src/game/roomManager.js';
import {
  startHand, processAction, getActivePlayer, getActivePlayerActions,
} from '../src/game/handStateMachine.js';

function makePlayer(id: string, seat: number, chips = 1000): RoomPlayer {
  return {
    playerId: id,
    displayName: id,
    isBot: false,
    isHost: seat === 0,
    isReady: true,
    seatIndex: seat,
    chips,
    playerState: PlayerState.ACTIVE,
    buyInCount: 0,
  };
}

describe('Game integration', () => {
  describe('room lifecycle', () => {
    beforeEach(() => {
      // Clean up any leftover rooms
      for (const room of roomManager.getAllRooms()) {
        roomManager.closeRoom(room.roomId);
      }
    });

    it('creates a room and adds players', () => {
      const room = roomManager.createRoom('r1', 'CODE01', 'host1', DEFAULT_ROOM_CONFIG);
      expect(room.state).toBe(RoomState.WAITING);

      const added = roomManager.addPlayer('r1', makePlayer('host1', 0));
      expect(added).toBe(true);

      const added2 = roomManager.addPlayer('r1', makePlayer('p2', 1));
      expect(added2).toBe(true);

      expect(room.players).toHaveLength(2);
    });

    it('rejects duplicate player', () => {
      roomManager.createRoom('r2', 'CODE02', 'host1', DEFAULT_ROOM_CONFIG);
      roomManager.addPlayer('r2', makePlayer('host1', 0));
      const dup = roomManager.addPlayer('r2', makePlayer('host1', 1));
      expect(dup).toBe(false);
    });

    it('removes player and selects new host', () => {
      roomManager.createRoom('r3', 'CODE03', 'host1', DEFAULT_ROOM_CONFIG);
      roomManager.addPlayer('r3', makePlayer('host1', 0));
      roomManager.addPlayer('r3', makePlayer('p2', 1));

      roomManager.removePlayer('r3', 'host1');
      const newHost = roomManager.selectNewHost('r3');
      expect(newHost).toBe('p2');
    });
  });

  describe('hand state machine', () => {
    it('deals cards and sets up blinds', () => {
      const players = [makePlayer('p1', 0), makePlayer('p2', 1)];
      const ctx = startHand('h1', 'r1', 1, players, 0, 10, 20);

      expect(ctx.phase).toBe(HandPhase.PRE_FLOP);
      expect(ctx.players).toHaveLength(2);
      for (const p of ctx.players) {
        expect(p.holeCards).toHaveLength(2);
      }

      // In heads-up: dealer (seat 0) posts SB, other posts BB
      const totalBlinds = ctx.players.reduce((sum, p) => sum + p.totalBet, 0);
      expect(totalBlinds).toBe(30); // 10 + 20
    });

    it('processes a fold and awards pot', () => {
      const players = [makePlayer('p1', 0), makePlayer('p2', 1)];
      const ctx = startHand('h2', 'r1', 1, players, 0, 10, 20);

      const active = getActivePlayer(ctx)!;
      const result = processAction(ctx, active.playerId, { type: ActionType.FOLD });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.winners).toBeDefined();
        expect(result.winners!).toHaveLength(1);
      }
    });

    it('rejects action from wrong player', () => {
      const players = [makePlayer('p1', 0), makePlayer('p2', 1)];
      const ctx = startHand('h3', 'r1', 1, players, 0, 10, 20);

      const active = getActivePlayer(ctx)!;
      const otherId = ctx.players.find((p) => p.playerId !== active.playerId)!.playerId;

      const result = processAction(ctx, otherId, { type: ActionType.FOLD });
      expect('error' in result).toBe(true);
    });

    it('advances through all phases to showdown', () => {
      const players = [
        makePlayer('p1', 0, 1000),
        makePlayer('p2', 1, 1000),
      ];
      const ctx = startHand('h4', 'r1', 1, players, 0, 10, 20);

      // Pre-flop: p1 calls (UTG in heads-up is the dealer)
      let active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CALL });

      // BB checks (big blind option)
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });

      // Should be on FLOP now
      expect(ctx.communityCards.length).toBeGreaterThanOrEqual(3);

      // Flop: both check
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });

      // Should be TURN
      expect(ctx.communityCards.length).toBeGreaterThanOrEqual(4);

      // Turn: both check
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });

      // Should be RIVER
      expect(ctx.communityCards.length).toBe(5);

      // River: both check → showdown
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.CHECK });
      active = getActivePlayer(ctx)!;
      const result = processAction(ctx, active.playerId, { type: ActionType.CHECK });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.winners).toBeDefined();
        expect(result.showdownResults).toBeDefined();
      }
    });

    it('creates side pots with all-in', () => {
      const players = [
        makePlayer('p1', 0, 100),
        makePlayer('p2', 1, 500),
        makePlayer('p3', 2, 500),
      ];
      const ctx = startHand('h5', 'r1', 1, players, 0, 10, 20);

      // p3 is UTG (left of BB): goes all-in
      let active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.ALL_IN });

      // p1 (SB) calls with their remaining chips (all-in for less)
      active = getActivePlayer(ctx)!;
      processAction(ctx, active.playerId, { type: ActionType.ALL_IN });

      // p2 (BB) calls
      active = getActivePlayer(ctx)!;
      const result = processAction(ctx, active.playerId, { type: ActionType.CALL });

      // Hand should resolve (all action is done — run out board + showdown)
      if (!('error' in result)) {
        expect(result.winners).toBeDefined();
      }
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'net';

import {
  ROOM_EVENTS, GAME_EVENTS,
  ActionType,
  type Card, type Suit, type Rank,
} from '@poker/shared';
import { authRoutes } from '../src/routes/auth.js';
import { roomRoutes } from '../src/routes/rooms.js';
import { createSocketServer } from '../src/socket/index.js';
import { roomManager } from '../src/game/roomManager.js';
import { setShuffleOverride, resetGameState } from '../src/socket/gameHandlers.js';
import { prisma } from '../src/db/client.js';

// ---------------------------------------------------------------------------
// Event collector — buffers socket events to prevent race conditions.
// All room-broadcast events are captured and can be consumed in order.
// ---------------------------------------------------------------------------

class EventCollector {
  private buffer = new Map<string, unknown[]>();
  private waiters = new Map<string, {
    resolve: (data: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }[]>();

  constructor(readonly socket: ClientSocket) {
    socket.onAny((event: string, data: unknown) => {
      const pending = this.waiters.get(event);
      if (pending && pending.length > 0) {
        const { resolve, timer } = pending.shift()!;
        clearTimeout(timer);
        resolve(data);
        return;
      }
      if (!this.buffer.has(event)) this.buffer.set(event, []);
      this.buffer.get(event)!.push(data);
    });
  }

  wait<T = unknown>(event: string, ms = 15_000): Promise<T> {
    const buf = this.buffer.get(event);
    if (buf && buf.length > 0) {
      return Promise.resolve(buf.shift() as T);
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const arr = this.waiters.get(event);
        if (arr) {
          const idx = arr.findIndex((w) => w.timer === timer);
          if (idx !== -1) arr.splice(idx, 1);
        }
        reject(new Error(`Timeout waiting for "${event}"`));
      }, ms);
      if (!this.waiters.has(event)) this.waiters.set(event, []);
      this.waiters.get(event)!.push({ resolve: resolve as (d: unknown) => void, timer });
    });
  }

  emit(event: string, data?: unknown) {
    this.socket.emit(event, data);
  }
}

// ---------------------------------------------------------------------------
// Card / deck helpers
// ---------------------------------------------------------------------------

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

/**
 * Build a shuffle function that places specific hole cards and community cards.
 * Deal order per round: P1, P2, ..., Pn — repeated twice.
 * Then: burn, flop(3), burn, turn(1), burn, river(1).
 */
function rigDeck(holeCards: Card[][], community: Card[]) {
  return (_deck: Card[]) => {
    const result: Card[] = [];
    const n = holeCards.length;

    for (let round = 0; round < 2; round++) {
      for (let p = 0; p < n; p++) {
        result.push(holeCards[p][round]);
      }
    }

    const key = (cc: Card) => `${cc.rank}:${cc.suit}`;
    const usedKeys = new Set(result.map(key));
    for (const cc of community) usedKeys.add(key(cc));
    const unused = _deck.filter((cc) => !usedKeys.has(key(cc)));

    result.push(unused.shift()!);
    result.push(community[0], community[1], community[2]);
    result.push(unused.shift()!);
    result.push(community[3]);
    result.push(unused.shift()!);
    result.push(community[4]);
    result.push(...unused);
    return result;
  };
}

// ---------------------------------------------------------------------------
// Server harness
// ---------------------------------------------------------------------------

let serverUrl: string;
let httpServer: ReturnType<typeof Fastify> | null = null;
let ioServer: SocketServer | null = null;
const rawSockets: ClientSocket[] = [];

async function createTestServer() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(cookie);
  await app.register(authRoutes);
  await app.register(roomRoutes);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${addr.port}`;
  ioServer = createSocketServer(app.server, ['*']);
  httpServer = app;
}

async function destroyTestServer() {
  for (const s of rawSockets) if (s.connected) s.disconnect();
  rawSockets.length = 0;
  if (ioServer) { await new Promise<void>((r) => ioServer!.close(() => r())); ioServer = null; }
  if (httpServer) { await httpServer.close(); httpServer = null; }
}

function cleanupSockets() {
  for (const s of rawSockets) if (s.connected) s.disconnect();
  rawSockets.length = 0;
}

function cleanInMemory() {
  for (const room of roomManager.getAllRooms()) roomManager.closeRoom(room.roomId);
  resetGameState();
  setShuffleOverride(null);
}

async function guestToken(): Promise<{ token: string; userId: string; displayName: string }> {
  const res = await fetch(`${serverUrl}/auth/guest`, { method: 'POST' });
  const body = await res.json() as { accessToken: string; guestId: string; displayName: string };
  return { token: body.accessToken, userId: body.guestId, displayName: body.displayName };
}

async function createRoomRest(token: string) {
  const res = await fetch(`${serverUrl}/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<{ roomId: string; roomCode: string }>;
}

async function joinRoomRest(token: string, roomCode: string) {
  await fetch(`${serverUrl}/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function connect(token: string, roomId: string): EventCollector {
  const socket = ioClient(serverUrl, {
    auth: { token },
    query: { roomId },
    transports: ['websocket'],
    forceNew: true,
  });
  rawSockets.push(socket);
  return new EventCollector(socket);
}

async function truncateAll() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE game_hands, room_players, rooms, users CASCADE');
}

// ---------------------------------------------------------------------------
// Game helper types
// ---------------------------------------------------------------------------

type TurnStart = {
  playerId: string;
  canCheck: boolean;
  canRaise: boolean;
  callAmount: number;
  minRaise: number;
};

type StartData = {
  handId: string;
  handNumber: number;
  dealerSeatIndex: number;
  players: { playerId: string; seatIndex: number; chips: number; chipsAtStart: number }[];
};

type HandResult = {
  winners: { playerId: string; potIndex: number; amount: number; handRank?: string }[];
  players: { id: string; chipsEnd: number }[];
};

// ---------------------------------------------------------------------------
// Game setup helper
// ---------------------------------------------------------------------------

/**
 * Creates N guests, a room, connects them all, and readies up.
 *
 * Returns after game:start and game:dealHoleCards are received.
 * `monitor` (ecs[0]) should be used for all room-broadcast reads (TURN_START,
 * ACTION_BROADCAST, PHASE_CHANGE, SHOWDOWN, HAND_RESULT).
 * Player-specific ecs should be used only for emitting actions and reading
 * targeted events (DEAL_HOLE_CARDS).
 */
async function setupAndStartGame(
  playerCount: number,
  opts?: { chipOverrides?: Record<number, number> },
) {
  const guests = await Promise.all(Array.from({ length: playerCount }, () => guestToken()));
  const { roomId, roomCode } = await createRoomRest(guests[0].token);

  const ecs: EventCollector[] = [];
  for (let i = 0; i < guests.length; i++) {
    if (i > 0) await joinRoomRest(guests[i].token, roomCode);
    const ec = connect(guests[i].token, roomId);
    await ec.wait(ROOM_EVENTS.JOINED);
    ecs.push(ec);
  }

  if (opts?.chipOverrides) {
    const room = roomManager.getRoomByCode(roomCode)!;
    for (const [idx, chips] of Object.entries(opts.chipOverrides)) {
      const p = room.players[Number(idx)];
      if (p) p.chips = chips;
    }
  }

  for (const ec of ecs) ec.emit(ROOM_EVENTS.READY_TOGGLE);

  // Read START from the monitor (ecs[0]). Other ecs buffer it but we ignore them.
  const startData = await ecs[0].wait<StartData>(GAME_EVENTS.START, 20_000);

  // Each player receives their own hole cards via targeted emit.
  const holeCards = await Promise.all(
    ecs.map((ec) => ec.wait<{ cards: Card[] }>(GAME_EVENTS.DEAL_HOLE_CARDS, 5_000)),
  );

  return { guests, ecs, roomId, roomCode, startData, holeCards };
}

/**
 * Wait for the next TURN_START on the monitor, emit an action from the correct
 * player's collector, and wait for ACTION_BROADCAST on the monitor.
 */
async function act(
  monitor: EventCollector,
  ecs: EventCollector[],
  guests: { userId: string }[],
  action: { type: ActionType; amount?: number },
): Promise<TurnStart> {
  const turn = await monitor.wait<TurnStart>(GAME_EVENTS.TURN_START);
  const idx = guests.findIndex((g) => g.userId === turn.playerId);
  ecs[idx].emit(GAME_EVENTS.ACTION, action);
  await monitor.wait(GAME_EVENTS.ACTION_BROADCAST);
  return turn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full game integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await truncateAll();
    await createTestServer();
  });

  afterAll(async () => {
    await destroyTestServer();
    await truncateAll();
    await prisma.$disconnect();
  });

  afterEach(() => {
    cleanupSockets();
    cleanInMemory();
  });

  // -----------------------------------------------------------------------
  // 1. REST Auth
  // -----------------------------------------------------------------------
  describe('Authentication', () => {
    it('creates a guest session and returns a valid JWT', async () => {
      const { token, userId, displayName } = await guestToken();
      expect(token).toBeTruthy();
      expect(userId).toBeTruthy();
      expect(displayName).toMatch(/^Guest#\d+$/);
    });

    it('rejects room creation without auth', async () => {
      const res = await fetch(`${serverUrl}/rooms`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Room lifecycle via REST
  // -----------------------------------------------------------------------
  describe('Room lifecycle via REST', () => {
    it('creates a room and returns roomCode and config', async () => {
      const { token } = await guestToken();
      const res = await fetch(`${serverUrl}/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { roomId: string; roomCode: string };
      expect(body.roomId).toBeTruthy();
      expect(body.roomCode).toHaveLength(6);
    });

    it('returns room info for a valid room code', async () => {
      const { token } = await guestToken();
      const { roomCode } = await createRoomRest(token);
      const res = await fetch(`${serverUrl}/rooms/${roomCode}`);
      expect(res.status).toBe(200);
      const info = await res.json() as { roomCode: string; state: string };
      expect(info.roomCode).toBe(roomCode);
      expect(info.state).toBe('WAITING');
    });

    it('returns 404 for non-existent room', async () => {
      const res = await fetch(`${serverUrl}/rooms/ZZZZZZ`);
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Socket.io room flow
  // -----------------------------------------------------------------------
  describe('Socket room flow', () => {
    it('player connects, joins room, receives room:joined', async () => {
      const { token } = await guestToken();
      const { roomId } = await createRoomRest(token);
      const ec = connect(token, roomId);
      const joined = await ec.wait<{ room: { roomId: string } }>(ROOM_EVENTS.JOINED);
      expect(joined.room.roomId).toBe(roomId);
    });

    it('second player join is broadcast to first player', async () => {
      const host = await guestToken();
      const guest2 = await guestToken();
      const { roomId, roomCode } = await createRoomRest(host.token);

      const ec1 = connect(host.token, roomId);
      await ec1.wait(ROOM_EVENTS.JOINED);

      await joinRoomRest(guest2.token, roomCode);
      const ec2 = connect(guest2.token, roomId);
      await ec2.wait(ROOM_EVENTS.JOINED);

      const evt = await ec1.wait<{ player: { playerId: string } }>(ROOM_EVENTS.PLAYER_JOINED);
      expect(evt.player.playerId).toBe(guest2.userId);
    });

    it('host adds a bot', async () => {
      const host = await guestToken();
      const { roomId } = await createRoomRest(host.token);
      const ec = connect(host.token, roomId);
      await ec.wait(ROOM_EVENTS.JOINED);

      ec.emit(ROOM_EVENTS.ADD_BOT);
      const evt = await ec.wait<{ player: { isBot: boolean; displayName: string } }>(ROOM_EVENTS.BOT_ADDED);
      expect(evt.player.isBot).toBe(true);
      expect(evt.player.displayName).toMatch(/^Bot_[A-Z][a-z]+\d{2}_N$/);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Heads-up hand: fold wins
  // -----------------------------------------------------------------------
  describe('Heads-up hand: fold wins', () => {
    it('SB calls then BB folds — SB wins the pot', async () => {
      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      // Pre-flop: SB (dealer in HU) acts first. SB calls.
      const sbTurn = await act(monitor, ecs, guests, { type: ActionType.CALL });
      const sbId = sbTurn.playerId;

      // BB's turn — fold.
      const bbTurn = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      const bbId = bbTurn.playerId;

      expect(sbId).not.toBe(bbId);

      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].playerId).toBe(sbId);
      expect(result.winners[0].amount).toBe(40); // SB=20 + BB=20

      const winner = result.players.find((p) => p.id === sbId)!;
      const loser = result.players.find((p) => p.id === bbId)!;
      expect(winner.chipsEnd).toBe(1020); // 1000 - 20 + 40
      expect(loser.chipsEnd).toBe(980);   // 1000 - 20
    });
  });

  // -----------------------------------------------------------------------
  // 5. Heads-up hand: showdown with rigged deck
  // -----------------------------------------------------------------------
  describe('Heads-up hand: showdown with known cards', () => {
    it('P1 wins with pair of Aces vs P2 high card King', async () => {
      // P1 (seat 0): Ah, Ad  — pair of Aces
      // P2 (seat 1): 7c, 2d  — junk
      // Board: Ks Qs 8h 3c 4d
      setShuffleOverride(rigDeck(
        [[c('A', 'hearts'), c('A', 'diamonds')], [c('7', 'clubs'), c('2', 'diamonds')]],
        [c('K', 'spades'), c('Q', 'spades'), c('8', 'hearts'), c('3', 'clubs'), c('4', 'diamonds')],
      ));

      const { guests, ecs, holeCards } = await setupAndStartGame(2);
      const [p1] = guests;
      const monitor = ecs[0];

      // Verify P1 got Aces
      const p1Ranks = holeCards[0].cards.map((cc: Card) => cc.rank).sort();
      expect(p1Ranks).toEqual(['A', 'A']);

      // Pre-flop: SB calls, BB checks
      await act(monitor, ecs, guests, { type: ActionType.CALL });
      await act(monitor, ecs, guests, { type: ActionType.CHECK });

      // Flop: check-check
      await monitor.wait(GAME_EVENTS.PHASE_CHANGE);
      await act(monitor, ecs, guests, { type: ActionType.CHECK });
      await act(monitor, ecs, guests, { type: ActionType.CHECK });

      // Turn: check-check
      await monitor.wait(GAME_EVENTS.PHASE_CHANGE);
      await act(monitor, ecs, guests, { type: ActionType.CHECK });
      await act(monitor, ecs, guests, { type: ActionType.CHECK });

      // River: check-check → showdown
      await monitor.wait(GAME_EVENTS.PHASE_CHANGE);
      await act(monitor, ecs, guests, { type: ActionType.CHECK });
      await act(monitor, ecs, guests, { type: ActionType.CHECK });

      const showdown = await monitor.wait<{ players: { playerId: string; handRank: string }[] }>(
        GAME_EVENTS.SHOWDOWN,
      );
      expect(showdown.players).toHaveLength(2);

      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].playerId).toBe(p1.userId);
      expect(result.winners[0].amount).toBe(40);

      const p1End = result.players.find((p) => p.id === p1.userId)!;
      expect(p1End.chipsEnd).toBe(1020);
    });
  });

  // -----------------------------------------------------------------------
  // 6. 3-player hand with all-in
  // -----------------------------------------------------------------------
  describe('3-player hand with all-in', () => {
    it('short-stack all-in, P2 calls, P3 folds — P2 (Aces) wins', async () => {
      // P1 (seat 0, dealer, 200 chips): Ks Kd — pair of Kings
      // P2 (seat 1, SB, 1000 chips): Ah Ad — pair of Aces
      // P3 (seat 2, BB, 1000 chips): 2c 3c — junk
      // Board: 10s 8d 5h Jc 7d
      setShuffleOverride(rigDeck(
        [
          [c('K', 'spades'), c('K', 'diamonds')],
          [c('A', 'hearts'), c('A', 'diamonds')],
          [c('2', 'clubs'), c('3', 'clubs')],
        ],
        [c('10', 'spades'), c('8', 'diamonds'), c('5', 'hearts'), c('J', 'clubs'), c('7', 'diamonds')],
      ));

      const { guests, ecs } = await setupAndStartGame(3, { chipOverrides: { 0: 200 } });
      const monitor = ecs[0];
      const [p1, p2, p3] = guests;

      // UTG = P1 (left of BB). All-in (200 chips).
      const t1 = await act(monitor, ecs, guests, { type: ActionType.ALL_IN });
      expect(t1.playerId).toBe(p1.userId);

      // P2 (SB) calls
      const t2 = await act(monitor, ecs, guests, { type: ActionType.CALL });
      expect(t2.playerId).toBe(p2.userId);

      // P3 (BB) folds
      const t3 = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      expect(t3.playerId).toBe(p3.userId);

      // P1 all-in, P2 called → board runs out → showdown → P2 wins
      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      const p2Winnings = result.winners
        .filter((w) => w.playerId === p2.userId)
        .reduce((sum, w) => sum + w.amount, 0);

      // Total: P1(200) + P2(200: SB 10 + call 190) + P3(20: BB fold) = 420
      expect(p2Winnings).toBe(420);

      expect(result.players.find((p) => p.id === p1.userId)!.chipsEnd).toBe(0);
      expect(result.players.find((p) => p.id === p2.userId)!.chipsEnd).toBe(1220);
      expect(result.players.find((p) => p.id === p3.userId)!.chipsEnd).toBe(980);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Multi-hand chip persistence
  // -----------------------------------------------------------------------
  describe('Multi-hand chip persistence', () => {
    it('plays two consecutive hands with correct chip carryover', async () => {
      const { guests, ecs, startData: start1 } = await setupAndStartGame(2);
      const monitor = ecs[0];

      expect(start1.handNumber).toBe(1);

      // Hand 1: SB folds pre-flop → BB wins 30
      const sbTurn = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      const sbId = sbTurn.playerId;
      const bbId = guests.find((g) => g.userId !== sbId)!.userId;

      const r1 = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(r1.winners[0].playerId).toBe(bbId);

      // SB lost 10, BB gained 10
      expect(r1.players.find((p) => p.id === sbId)!.chipsEnd).toBe(990);
      expect(r1.players.find((p) => p.id === bbId)!.chipsEnd).toBe(1010);

      // Hand 2 auto-starts after BETWEEN_HAND_PAUSE (5s)
      const start2 = await monitor.wait<StartData>(GAME_EVENTS.START, 20_000);
      expect(start2.handNumber).toBe(2);

      // chipsAtStart reflects pre-blind carryover
      const sbH2 = start2.players.find((p) => p.playerId === sbId)!;
      const bbH2 = start2.players.find((p) => p.playerId === bbId)!;
      expect(sbH2.chipsAtStart).toBe(990);
      expect(bbH2.chipsAtStart).toBe(1010);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Error handling
  // -----------------------------------------------------------------------
  describe('Error handling', () => {
    it('rejects action from wrong player', async () => {
      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      const turn = await monitor.wait<TurnStart>(GAME_EVENTS.TURN_START);
      const wrongIdx = guests.findIndex((g) => g.userId !== turn.playerId);
      const wrongEc = ecs[wrongIdx];

      wrongEc.emit(GAME_EVENTS.ACTION, { type: ActionType.FOLD });
      const err = await wrongEc.wait<{ code: string; message: string }>('error');
      expect(err.code).toBe('INVALID_ACTION');
      expect(err.message).toContain('Not your turn');
    });

    it('rejects unauthenticated socket connection', async () => {
      const sock = ioClient(serverUrl, { transports: ['websocket'], forceNew: true });
      rawSockets.push(sock);
      const err = await new Promise<Error>((resolve) => {
        sock.on('connect_error', (e: Error) => resolve(e));
      });
      expect(err.message).toContain('Authentication required');
    });
  });

  // -----------------------------------------------------------------------
  // 9. game:stateUpdate carries full public state
  // -----------------------------------------------------------------------
  describe('game:stateUpdate unified state', () => {
    it('receives a complete GamePublicState on every mutation', async () => {
      setShuffleOverride(rigDeck(
        [[c('A', 'hearts'), c('A', 'diamonds')], [c('7', 'clubs'), c('2', 'diamonds')]],
        [c('K', 'spades'), c('Q', 'spades'), c('8', 'hearts'), c('3', 'clubs'), c('4', 'diamonds')],
      ));

      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      // First stateUpdate arrives right after game start
      const s1 = await monitor.wait<Record<string, unknown>>(GAME_EVENTS.STATE_UPDATE, 5_000);
      expect(s1.handId).toBeTruthy();
      expect(s1.phase).toBe('PRE_FLOP');
      expect(s1.dealerSeatIndex).toBeDefined();
      expect(s1.communityCards).toEqual([]);
      expect(s1.totalPot).toBeGreaterThan(0);
      expect(s1.activePlayerId).toBeTruthy();
      expect(s1.activePlayerActions).not.toBeNull();
      expect(s1.winners).toBeNull();

      const players = s1.players as { displayName: string; chips: number; handState: string; isDealer: boolean }[];
      expect(players).toHaveLength(2);
      expect(players.every((p) => p.displayName && p.chips > 0)).toBe(true);
      expect(players.some((p) => p.isDealer)).toBe(true);

      // After an action, another stateUpdate arrives
      await act(monitor, ecs, guests, { type: ActionType.CALL });
      const s2 = await monitor.wait<Record<string, unknown>>(GAME_EVENTS.STATE_UPDATE, 5_000);
      expect(s2.phase).toBe('PRE_FLOP');

      const p2 = s2.players as { lastAction: { type: string } | null }[];
      expect(p2.some((p) => p.lastAction?.type === 'CALL')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 10. Database persistence
  // -----------------------------------------------------------------------
  describe('Database persistence', () => {
    it('room creation persists to database', async () => {
      const { token } = await guestToken();
      const { roomCode } = await createRoomRest(token);
      const dbRoom = await prisma.room.findUnique({ where: { roomCode } });
      expect(dbRoom).not.toBeNull();
      expect(dbRoom!.state).toBe('WAITING');
    });
  });
});

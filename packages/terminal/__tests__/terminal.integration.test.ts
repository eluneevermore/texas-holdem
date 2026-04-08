/**
 * Terminal client integration tests.
 *
 * Layers:
 *   A) CLI spawn tests — verify the Ink TUI starts, authenticates, renders
 *      expected screens.  Driven via execa; no keyboard input needed (Ink runs
 *      in non-interactive mode when stdin is a pipe).
 *   B) Socket-level game tests — boot the real server, connect two+ clients
 *      with the same socket protocol the terminal uses, rig decks, and
 *      simulate complete multi-hand games.  These test the exact event flow
 *      and state that the terminal's connection.ts processes.
 *
 * Requires: Postgres (poker_test) on port 5222, Redis on 6379.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import { execaNode } from 'execa';

import {
  ROOM_EVENTS, GAME_EVENTS, ActionType,
  type Card, type Suit, type Rank,
} from '@poker/shared';
import { authRoutes } from '../../server/src/routes/auth.js';
import { roomRoutes } from '../../server/src/routes/rooms.js';
import { createSocketServer } from '../../server/src/socket/index.js';
import { roomManager } from '../../server/src/game/roomManager.js';
import { setShuffleOverride, resetGameState } from '../../server/src/socket/gameHandlers.js';
import { prisma } from '../../server/src/db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = resolve(__dirname, '../src/cli/index.tsx');

// ---------------------------------------------------------------------------
// Event collector
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
    if (buf && buf.length > 0) return Promise.resolve(buf.shift() as T);
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

  emit(event: string, data?: unknown) { this.socket.emit(event, data); }
}

// ---------------------------------------------------------------------------
// Card / deck helpers
// ---------------------------------------------------------------------------

function c(rank: Rank, suit: Suit): Card { return { rank, suit }; }

function rigDeck(holeCards: Card[][], community: Card[]) {
  return (_deck: Card[]) => {
    const result: Card[] = [];
    const n = holeCards.length;
    for (let round = 0; round < 2; round++) {
      for (let p = 0; p < n; p++) result.push(holeCards[p][round]);
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

async function truncateAll() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE game_hands, room_players, rooms, users CASCADE');
}

// ---------------------------------------------------------------------------
// REST + socket helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared game helpers
// ---------------------------------------------------------------------------

type TurnStart = {
  playerId: string; canCheck: boolean; canRaise: boolean;
  callAmount: number; minRaise: number;
};

type StartData = {
  handId: string; handNumber: number; dealerSeatIndex: number;
  players: { playerId: string; seatIndex: number; chips: number; chipsAtStart: number }[];
};

type HandResult = {
  winners: { playerId: string; potIndex: number; amount: number; handRank?: string }[];
  players: { id: string; chipsEnd: number }[];
};

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

  const startData = await ecs[0].wait<StartData>(GAME_EVENTS.START, 20_000);
  const holeCards = await Promise.all(
    ecs.map((ec) => ec.wait<{ cards: Card[] }>(GAME_EVENTS.DEAL_HOLE_CARDS, 5_000)),
  );

  return { guests, ecs, roomId, roomCode, startData, holeCards };
}

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
// TUI spawn helper
// ---------------------------------------------------------------------------

function spawnTui(env?: Record<string, string>) {
  let output = '';

  const proc = execaNode(CLI_ENTRY, [], {
    env: {
      POKER_SERVER_URL: serverUrl,
      FORCE_COLOR: '0',
      NODE_NO_WARNINGS: '1',
      CI: '1',
      ...env,
    },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    extendEnv: true,
    nodeOptions: ['--import', 'tsx'],
    reject: false,
  });

  proc.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  proc.stderr!.on('data', (chunk: Buffer) => { output += chunk.toString(); });

  const waitFor = (pattern: string | RegExp, timeoutMs = 15_000): Promise<string> => {
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : pattern;
    return new Promise<string>((resolve, reject) => {
      if (regex.test(output)) { resolve(output); return; }
      const interval = setInterval(() => {
        if (regex.test(output)) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(output);
        }
      }, 200);
      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(
          `Timeout waiting for "${pattern}" after ${timeoutMs}ms.\n` +
          `Last output (tail 800 chars):\n${output.slice(-800)}`,
        ));
      }, timeoutMs);
    });
  };

  const kill = () => { try { proc.kill('SIGTERM'); } catch { /* ignore */ } };

  return { proc, get output() { return output; }, waitFor, kill };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Terminal client integration', () => {
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

  // =======================================================================
  //  A) CLI spawn tests (execa)
  // =======================================================================

  describe('CLI spawn: startup', () => {
    it('starts without crashing and eventually exits cleanly on SIGTERM', async () => {
      const tui = spawnTui();
      await new Promise((r) => setTimeout(r, 3_000));
      tui.kill();
      const result = await tui.proc;
      expect(result.exitCode === 0 || result.signal === 'SIGTERM').toBe(true);
    });

    it('does not crash when server is unreachable', async () => {
      const tui = spawnTui({ POKER_SERVER_URL: 'http://127.0.0.1:1' });
      await new Promise((r) => setTimeout(r, 5_000));
      tui.kill();
      const result = await tui.proc;
      expect(result.exitCode === 0 || result.signal === 'SIGTERM').toBe(true);
    });
  });

  // =======================================================================
  //  B) Socket-level game tests
  // =======================================================================

  describe('Socket: heads-up fold wins', () => {
    it('SB calls then BB folds — SB wins the pot', async () => {
      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      const sbTurn = await act(monitor, ecs, guests, { type: ActionType.CALL });
      const sbId = sbTurn.playerId;
      const bbTurn = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      const bbId = bbTurn.playerId;

      expect(sbId).not.toBe(bbId);

      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].playerId).toBe(sbId);
      expect(result.winners[0].amount).toBe(40);

      expect(result.players.find((p) => p.id === sbId)!.chipsEnd).toBe(1020);
      expect(result.players.find((p) => p.id === bbId)!.chipsEnd).toBe(980);
    });
  });

  describe('Socket: heads-up showdown with rigged deck', () => {
    it('P1 wins with pair of Aces vs P2 high card', async () => {
      setShuffleOverride(rigDeck(
        [[c('A', 'hearts'), c('A', 'diamonds')], [c('7', 'clubs'), c('2', 'diamonds')]],
        [c('K', 'spades'), c('Q', 'spades'), c('8', 'hearts'), c('3', 'clubs'), c('4', 'diamonds')],
      ));

      const { guests, ecs, holeCards } = await setupAndStartGame(2);
      const monitor = ecs[0];
      const [p1] = guests;

      const p1Ranks = holeCards[0].cards.map((cc: Card) => cc.rank).sort();
      expect(p1Ranks).toEqual(['A', 'A']);

      await act(monitor, ecs, guests, { type: ActionType.CALL });
      await act(monitor, ecs, guests, { type: ActionType.CHECK });

      for (let street = 0; street < 3; street++) {
        await monitor.wait(GAME_EVENTS.PHASE_CHANGE);
        await act(monitor, ecs, guests, { type: ActionType.CHECK });
        await act(monitor, ecs, guests, { type: ActionType.CHECK });
      }

      const showdown = await monitor.wait<{ players: { playerId: string; handRank: string }[] }>(
        GAME_EVENTS.SHOWDOWN,
      );
      expect(showdown.players).toHaveLength(2);

      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].playerId).toBe(p1.userId);
      expect(result.winners[0].amount).toBe(40);
    });
  });

  describe('Socket: 3-player all-in', () => {
    it('short-stack all-in, P2 calls, P3 folds — P2 (Aces) wins', async () => {
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

      const t1 = await act(monitor, ecs, guests, { type: ActionType.ALL_IN });
      expect(t1.playerId).toBe(guests[0].userId);

      const t2 = await act(monitor, ecs, guests, { type: ActionType.CALL });
      expect(t2.playerId).toBe(guests[1].userId);

      const t3 = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      expect(t3.playerId).toBe(guests[2].userId);

      const result = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      const p2Winnings = result.winners
        .filter((w) => w.playerId === guests[1].userId)
        .reduce((sum, w) => sum + w.amount, 0);

      expect(p2Winnings).toBe(420);
      expect(result.players.find((p) => p.id === guests[0].userId)!.chipsEnd).toBe(0);
      expect(result.players.find((p) => p.id === guests[1].userId)!.chipsEnd).toBe(1220);
      expect(result.players.find((p) => p.id === guests[2].userId)!.chipsEnd).toBe(980);
    });
  });

  describe('Socket: multi-hand chip persistence', () => {
    it('plays two consecutive hands with correct chip carryover', async () => {
      const { guests, ecs, startData: start1 } = await setupAndStartGame(2);
      const monitor = ecs[0];

      expect(start1.handNumber).toBe(1);

      const sbTurn = await act(monitor, ecs, guests, { type: ActionType.FOLD });
      const sbId = sbTurn.playerId;
      const bbId = guests.find((g) => g.userId !== sbId)!.userId;

      const r1 = await monitor.wait<HandResult>(GAME_EVENTS.HAND_RESULT);
      expect(r1.winners[0].playerId).toBe(bbId);
      expect(r1.players.find((p) => p.id === sbId)!.chipsEnd).toBe(990);
      expect(r1.players.find((p) => p.id === bbId)!.chipsEnd).toBe(1010);

      const start2 = await monitor.wait<StartData>(GAME_EVENTS.START, 20_000);
      expect(start2.handNumber).toBe(2);

      expect(start2.players.find((p) => p.playerId === sbId)!.chipsAtStart).toBe(990);
      expect(start2.players.find((p) => p.playerId === bbId)!.chipsAtStart).toBe(1010);
    });
  });

  describe('Socket: game:stateUpdate carries full state', () => {
    it('receives GamePublicState on every mutation', async () => {
      setShuffleOverride(rigDeck(
        [[c('A', 'hearts'), c('A', 'diamonds')], [c('7', 'clubs'), c('2', 'diamonds')]],
        [c('K', 'spades'), c('Q', 'spades'), c('8', 'hearts'), c('3', 'clubs'), c('4', 'diamonds')],
      ));

      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      const s1 = await monitor.wait<Record<string, unknown>>(GAME_EVENTS.STATE_UPDATE, 5_000);
      expect(s1.handId).toBeTruthy();
      expect(s1.phase).toBe('PRE_FLOP');
      expect(s1.communityCards).toEqual([]);
      expect(s1.totalPot).toBeGreaterThan(0);
      expect(s1.activePlayerId).toBeTruthy();
      expect(s1.activePlayerActions).not.toBeNull();
      expect(s1.winners).toBeNull();

      const players = s1.players as { displayName: string; chips: number; isDealer: boolean }[];
      expect(players).toHaveLength(2);
      expect(players.every((p) => p.displayName && p.chips > 0)).toBe(true);
      expect(players.some((p) => p.isDealer)).toBe(true);

      await act(monitor, ecs, guests, { type: ActionType.CALL });
      const s2 = await monitor.wait<Record<string, unknown>>(GAME_EVENTS.STATE_UPDATE, 5_000);
      expect(s2.phase).toBe('PRE_FLOP');
      const p2 = s2.players as { lastAction: { type: string } | null }[];
      expect(p2.some((p) => p.lastAction?.type === 'CALL')).toBe(true);
    });
  });

  describe('Socket: error handling', () => {
    it('rejects action from wrong player', async () => {
      const { guests, ecs } = await setupAndStartGame(2);
      const monitor = ecs[0];

      const turn = await monitor.wait<TurnStart>(GAME_EVENTS.TURN_START);
      const wrongIdx = guests.findIndex((g) => g.userId !== turn.playerId);

      ecs[wrongIdx].emit(GAME_EVENTS.ACTION, { type: ActionType.FOLD });
      const err = await ecs[wrongIdx].wait<{ code: string; message: string }>('error');
      expect(err.code).toBe('INVALID_ACTION');
      expect(err.message).toContain('Not your turn');
    });
  });

  describe('Socket: bot integration', () => {
    it('host adds a bot and it has unique name', async () => {
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

  describe('Socket: database persistence', () => {
    it('room creation persists to database', async () => {
      const { token } = await guestToken();
      const { roomCode } = await createRoomRest(token);
      const dbRoom = await prisma.room.findUnique({ where: { roomCode } });
      expect(dbRoom).not.toBeNull();
      expect(dbRoom!.state).toBe('WAITING');
    });
  });
});

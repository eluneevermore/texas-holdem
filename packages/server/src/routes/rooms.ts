import type { FastifyInstance } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { ROOM_CODE_LENGTH, BUY_IN_CAP_MULTIPLIER, DEFAULT_ROOM_CONFIG } from '@poker/shared';
import * as roomRepo from '../db/roomRepository.js';
import * as handRepo from '../db/handRepository.js';
import { roomManager } from '../game/roomManager.js';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function roomRoutes(app: FastifyInstance) {
  // Create a room
  app.post('/rooms', { preHandler: authMiddleware }, async (request) => {
    const user = request.user!;
    const roomCode = generateRoomCode();
    const config = { ...DEFAULT_ROOM_CONFIG };

    const dbRoom = await roomRepo.createRoom({
      roomCode,
      hostId: user.userId,
      config,
    });

    roomManager.createRoom(dbRoom.id, roomCode, user.userId, config);

    return {
      roomId: dbRoom.id,
      roomCode,
      config,
    };
  });

  // Get room info (preview for join page)
  app.get('/rooms/:roomCode', { preHandler: optionalAuth }, async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string };
    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    return {
      roomCode: room.roomCode,
      state: room.state,
      playerCount: room.players.length,
      maxPlayers: room.config.maxPlayers,
      config: room.config,
    };
  });

  // Join a room
  app.post('/rooms/:roomCode/join', { preHandler: authMiddleware }, async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string };
    const user = request.user!;

    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    if (room.state === 'CLOSED') {
      return reply.status(400).send({ error: 'Room is closed' });
    }
    if (room.players.length >= room.config.maxPlayers) {
      return reply.status(400).send({ error: 'Room is full' });
    }
    if (room.state === 'PLAYING') {
      return reply.status(400).send({ error: 'Game is in progress, wait for the next hand' });
    }

    return { roomId: room.roomId, roomCode };
  });

  // Update room config (host only)
  app.patch('/rooms/:roomCode/config', { preHandler: authMiddleware }, async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string };
    const user = request.user!;
    const updates = request.body as Record<string, unknown>;

    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    if (room.hostId !== user.userId) {
      return reply.status(403).send({ error: 'Only the host can update config' });
    }
    if (room.state !== 'WAITING') {
      return reply.status(400).send({ error: 'Config can only be changed in WAITING state' });
    }

    // Validate buy-in cap
    if (updates.buyInAmount !== undefined) {
      const stack = (updates.initialStack as number) ?? room.config.initialStack;
      if ((updates.buyInAmount as number) > stack * BUY_IN_CAP_MULTIPLIER) {
        return reply.status(400).send({ error: `Buy-in must be ≤ ${stack * BUY_IN_CAP_MULTIPLIER}` });
      }
    }

    if (updates.bigBlind !== undefined && updates.smallBlind !== undefined) {
      if ((updates.bigBlind as number) < (updates.smallBlind as number) * 2) {
        return reply.status(400).send({ error: 'Big blind must be ≥ 2× small blind' });
      }
    }

    roomManager.updateConfig(roomCode, updates);
    await roomRepo.updateRoomConfig(room.roomId, updates);

    return { config: room.config };
  });

  // Get hand history
  app.get('/rooms/:roomCode/hands', { preHandler: authMiddleware }, async (request, reply) => {
    const { roomCode } = request.params as { roomCode: string };
    const { limit } = request.query as { limit?: string };

    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const hands = await handRepo.getHandHistory(room.roomId, Number(limit) || 10);
    return { hands };
  });

  // Get current user profile
  app.get('/me', { preHandler: authMiddleware }, async (request) => {
    const user = request.user!;
    return { userId: user.userId, displayName: user.displayName, isGuest: user.isGuest };
  });
}

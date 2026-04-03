import type { Server, Socket } from 'socket.io';
import {
  ROOM_EVENTS, GAME_EVENTS,
  PlayerState, RoomState,
  MIN_PLAYERS, AUTO_START_COUNTDOWN_SECONDS,
} from '@poker/shared';
import type { RoomPlayer } from '@poker/shared';
import { roomManager } from '../game/roomManager.js';
import { startGameForRoom } from './gameHandlers.js';
import type { TokenPayload } from '../auth/jwt.js';

export function registerRoomHandlers(io: Server, socket: Socket, user: TokenPayload) {
  let currentRoomId: string | null = null;

  socket.on(ROOM_EVENTS.READY_TOGGLE, () => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room) return;
    const player = room.players.find((p) => p.playerId === user.userId);
    if (!player || player.isBot) return;

    player.isReady = !player.isReady;
    io.to(currentRoomId).emit(ROOM_EVENTS.READY_CHANGED, {
      playerId: user.userId,
      isReady: player.isReady,
    });

    checkAutoStart(io, room);
  });

  socket.on(ROOM_EVENTS.ADD_BOT, () => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room || room.hostId !== user.userId) return;
    if (room.state !== RoomState.WAITING) return;
    if (room.players.length >= room.config.maxPlayers) {
      socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full' });
      return;
    }

    const botId = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const seatIndex = roomManager.getNextSeat(currentRoomId);
    const botPlayer: RoomPlayer = {
      playerId: botId,
      displayName: `Bot_Normal`,
      isBot: true,
      isHost: false,
      isReady: true,
      seatIndex,
      chips: room.config.initialStack,
      playerState: PlayerState.WAITING,
      buyInCount: 0,
    };

    roomManager.addPlayer(currentRoomId, botPlayer);
    io.to(currentRoomId).emit(ROOM_EVENTS.BOT_ADDED, { player: botPlayer });

    checkAutoStart(io, room);
  });

  socket.on(ROOM_EVENTS.KICK_PLAYER, ({ playerId }: { playerId: string }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room || room.hostId !== user.userId) return;

    const kicked = roomManager.removePlayer(currentRoomId, playerId);
    if (!kicked) return;

    io.to(currentRoomId).emit(ROOM_EVENTS.PLAYER_LEFT, { playerId });
    // Notify the kicked player's socket if connected
    const kickedSocketId = playerSocketMap.get(playerId);
    if (kickedSocketId) {
      io.to(kickedSocketId).emit(ROOM_EVENTS.KICKED, { reason: 'Kicked by host' });
    }
  });

  socket.on(ROOM_EVENTS.TRANSFER_HOST, ({ playerId }: { playerId: string }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room || room.hostId !== user.userId) return;

    const target = room.players.find((p) => p.playerId === playerId && !p.isBot);
    if (!target) return;

    roomManager.setHost(currentRoomId, playerId);
    io.to(currentRoomId).emit(ROOM_EVENTS.HOST_CHANGED, { newHostId: playerId });
  });

  socket.on(ROOM_EVENTS.CONFIG_UPDATE, (config: Record<string, unknown>) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room || room.hostId !== user.userId) return;
    if (room.state !== RoomState.WAITING) return;

    roomManager.updateConfig(room.roomCode, config);
    io.to(currentRoomId).emit(ROOM_EVENTS.CONFIG_CHANGED, { config: room.config });
  });

  return {
    joinRoom(roomId: string) {
      currentRoomId = roomId;
      socket.join(roomId);
      playerSocketMap.set(user.userId, socket.id);

      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const existingPlayer = room.players.find((p) => p.playerId === user.userId);
      if (existingPlayer) {
        // Reconnection
        existingPlayer.playerState = PlayerState.WAITING;
        socket.emit(ROOM_EVENTS.JOINED, { room: sanitizeRoom(room), player: existingPlayer });
        return;
      }

      const seatIndex = roomManager.getNextSeat(roomId);
      const player: RoomPlayer = {
        playerId: user.userId,
        displayName: user.displayName,
        isBot: false,
        isHost: room.players.length === 0,
        isReady: false,
        seatIndex,
        chips: room.config.initialStack,
        playerState: room.state === RoomState.PLAYING ? PlayerState.SITTING_OUT : PlayerState.WAITING,
        buyInCount: 0,
      };

      if (room.players.length === 0) {
        room.hostId = user.userId;
      }

      roomManager.addPlayer(roomId, player);
      socket.emit(ROOM_EVENTS.JOINED, { room: sanitizeRoom(room), player });
      socket.to(roomId).emit(ROOM_EVENTS.PLAYER_JOINED, { player });
    },

    leaveRoom() {
      if (!currentRoomId) return;
      const room = roomManager.getRoom(currentRoomId);
      if (!room) return;

      roomManager.removePlayer(currentRoomId, user.userId);
      playerSocketMap.delete(user.userId);
      socket.leave(currentRoomId);

      const humans = room.players.filter((p) => !p.isBot && p.playerState !== PlayerState.LEFT);
      if (humans.length === 0) {
        roomManager.closeRoom(currentRoomId);
        io.to(currentRoomId).emit(ROOM_EVENTS.CLOSED, {});
      } else if (room.hostId === user.userId) {
        const newHost = roomManager.selectNewHost(currentRoomId);
        if (newHost) {
          roomManager.setHost(currentRoomId, newHost);
          io.to(currentRoomId).emit(ROOM_EVENTS.HOST_CHANGED, { newHostId: newHost });
        }
      }

      io.to(currentRoomId).emit(ROOM_EVENTS.PLAYER_LEFT, {
        playerId: user.userId,
        newHostId: room.hostId,
      });
      currentRoomId = null;
    },

    getCurrentRoomId: () => currentRoomId,
  };
}

function checkAutoStart(io: Server, room: ReturnType<typeof roomManager.getRoom>) {
  if (!room || room.state !== RoomState.WAITING) return;
  const humans = room.players.filter((p) => !p.isBot);
  if (room.players.length < MIN_PLAYERS) return;
  if (!humans.every((p) => p.isReady)) return;

  let countdown = AUTO_START_COUNTDOWN_SECONDS;
  const interval = setInterval(() => {
    if (countdown <= 0) {
      clearInterval(interval);
      startGameForRoom(io, room.roomId);
      return;
    }
    io.to(room.roomId).emit(ROOM_EVENTS.COUNTDOWN, { seconds: countdown });
    countdown--;
  }, 1000);
}

function sanitizeRoom(room: NonNullable<ReturnType<typeof roomManager.getRoom>>) {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostId: room.hostId,
    state: room.state,
    handCount: room.handCount,
    config: room.config,
    players: room.players,
  };
}

/** Map of playerId → socketId for targeted emits. */
export const playerSocketMap = new Map<string, string>();

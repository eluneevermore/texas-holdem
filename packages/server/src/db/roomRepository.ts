import { prisma } from './client.js';
import type { RoomConfig } from '@poker/shared';

export async function createRoom(data: {
  roomCode: string;
  hostId: string;
  config: RoomConfig;
}) {
  return prisma.room.create({
    data: {
      roomCode: data.roomCode,
      hostId: data.hostId,
      smallBlind: data.config.smallBlind,
      bigBlind: data.config.bigBlind,
      initialStack: data.config.initialStack,
      buyInAllowed: data.config.buyInAllowed,
      buyInAmount: data.config.buyInAmount,
      maxPlayers: data.config.maxPlayers,
    },
    include: { players: true },
  });
}

export async function findRoomByCode(roomCode: string) {
  return prisma.room.findUnique({
    where: { roomCode },
    include: { players: true },
  });
}

export async function updateRoomConfig(roomId: string, config: Partial<RoomConfig>) {
  return prisma.room.update({
    where: { id: roomId },
    data: {
      ...(config.smallBlind !== undefined && { smallBlind: config.smallBlind }),
      ...(config.bigBlind !== undefined && { bigBlind: config.bigBlind }),
      ...(config.initialStack !== undefined && { initialStack: config.initialStack }),
      ...(config.buyInAllowed !== undefined && { buyInAllowed: config.buyInAllowed }),
      ...(config.buyInAmount !== undefined && { buyInAmount: config.buyInAmount }),
      ...(config.maxPlayers !== undefined && { maxPlayers: config.maxPlayers }),
    },
  });
}

export async function updateRoomState(roomId: string, state: string) {
  return prisma.room.update({
    where: { id: roomId },
    data: { state },
  });
}

export async function incrementHandCount(roomId: string) {
  return prisma.room.update({
    where: { id: roomId },
    data: { handCount: { increment: 1 } },
  });
}

export async function closeRoom(roomId: string) {
  return prisma.room.update({
    where: { id: roomId },
    data: { state: 'CLOSED', closedAt: new Date() },
  });
}

export async function addPlayerToRoom(data: {
  roomId: string;
  playerId: string;
  displayName: string;
  isBot: boolean;
  isHost: boolean;
  seatIndex: number;
  chips: number;
}) {
  return prisma.roomPlayer.create({ data });
}

export async function removePlayerFromRoom(roomId: string, playerId: string) {
  return prisma.roomPlayer.deleteMany({
    where: { roomId, playerId },
  });
}

export async function updatePlayerState(roomId: string, playerId: string, playerState: string) {
  return prisma.roomPlayer.updateMany({
    where: { roomId, playerId },
    data: { playerState },
  });
}

export async function updatePlayerChips(roomId: string, playerId: string, chips: number) {
  return prisma.roomPlayer.updateMany({
    where: { roomId, playerId },
    data: { chips },
  });
}

export async function updateRoomHost(roomId: string, newHostId: string) {
  // Remove host from all players, then set the new host
  await prisma.roomPlayer.updateMany({
    where: { roomId, isHost: true },
    data: { isHost: false },
  });
  await prisma.roomPlayer.updateMany({
    where: { roomId, playerId: newHostId },
    data: { isHost: true },
  });
  return prisma.room.update({
    where: { id: roomId },
    data: { hostId: newHostId },
  });
}

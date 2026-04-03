import { prisma } from './client.js';

export async function createGameHand(data: {
  roomId: string;
  handNumber: number;
  dealerSeatIndex: number;
}) {
  return prisma.gameHand.create({
    data: {
      roomId: data.roomId,
      handNumber: data.handNumber,
      dealerSeatIndex: data.dealerSeatIndex,
    },
  });
}

export async function updateGameHand(handId: string, data: {
  communityCards?: unknown;
  pots?: unknown;
  players?: unknown;
  winners?: unknown;
  phase?: string;
  currentBet?: number;
  completedAt?: Date;
}) {
  return prisma.gameHand.update({
    where: { id: handId },
    data: data as Record<string, unknown>,
  });
}

export async function getHandHistory(roomId: string, limit: number) {
  return prisma.gameHand.findMany({
    where: { roomId },
    orderBy: { handNumber: 'desc' },
    take: limit,
  });
}

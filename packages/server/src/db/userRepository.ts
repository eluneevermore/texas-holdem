import { prisma } from './client.js';

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}) {
  return prisma.user.create({ data });
}

export async function upsertUserByEmail(data: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: { displayName: data.displayName, avatarUrl: data.avatarUrl },
    create: data,
  });
}

export async function incrementGamesPlayed(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { gamesPlayed: { increment: 1 } },
  });
}

export async function incrementGamesWon(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { gamesWon: { increment: 1 } },
  });
}

export async function incrementTotalBuyIns(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { totalBuyIns: { increment: 1 } },
  });
}

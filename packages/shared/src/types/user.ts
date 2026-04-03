export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalBuyIns: number;
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  stats: UserStats;
}

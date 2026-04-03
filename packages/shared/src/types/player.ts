export enum PlayerState {
  WAITING = 'WAITING',
  SITTING_OUT = 'SITTING_OUT',
  ACTIVE = 'ACTIVE',
  FOLDED = 'FOLDED',
  ALL_IN = 'ALL_IN',
  OBSERVER = 'OBSERVER',
  DISCONNECTED = 'DISCONNECTED',
  LEFT = 'LEFT',
}

export interface RoomPlayer {
  playerId: string;
  displayName: string;
  isBot: boolean;
  isHost: boolean;
  isReady: boolean;
  seatIndex: number;
  chips: number;
  playerState: PlayerState;
  buyInCount: number;
}

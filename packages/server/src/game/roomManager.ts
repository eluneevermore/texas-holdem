import {
  type RoomConfig, type RoomPlayer,
  PlayerState, RoomState, DEFAULT_ROOM_CONFIG,
} from '@poker/shared';

export interface ServerRoom {
  roomId: string;
  roomCode: string;
  hostId: string;
  state: RoomState;
  handCount: number;
  config: RoomConfig;
  players: RoomPlayer[];
}

class RoomManager {
  private rooms = new Map<string, ServerRoom>();
  private codeIndex = new Map<string, string>();

  createRoom(roomId: string, roomCode: string, hostId: string, config: RoomConfig): ServerRoom {
    const room: ServerRoom = {
      roomId,
      roomCode,
      hostId,
      state: RoomState.WAITING,
      handCount: 0,
      config: { ...DEFAULT_ROOM_CONFIG, ...config },
      players: [],
    };
    this.rooms.set(roomId, room);
    this.codeIndex.set(roomCode, roomId);
    return room;
  }

  getRoom(roomId: string): ServerRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(roomCode: string): ServerRoom | undefined {
    const id = this.codeIndex.get(roomCode);
    return id ? this.rooms.get(id) : undefined;
  }

  addPlayer(roomId: string, player: RoomPlayer): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.players.length >= room.config.maxPlayers) return false;
    if (room.players.some((p) => p.playerId === player.playerId)) return false;
    room.players.push(player);
    return true;
  }

  removePlayer(roomId: string, playerId: string): RoomPlayer | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const idx = room.players.findIndex((p) => p.playerId === playerId);
    if (idx === -1) return undefined;
    return room.players.splice(idx, 1)[0];
  }

  getNextSeat(roomId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    const taken = new Set(room.players.map((p) => p.seatIndex));
    for (let i = 0; i < room.config.maxPlayers; i++) {
      if (!taken.has(i)) return i;
    }
    return -1;
  }

  updateConfig(roomCode: string, updates: Record<string, unknown>): void {
    const room = this.getRoomByCode(roomCode);
    if (!room) return;
    Object.assign(room.config, updates);
  }

  setRoomState(roomId: string, state: RoomState): void {
    const room = this.rooms.get(roomId);
    if (room) room.state = state;
  }

  setHost(roomId: string, hostId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.hostId = hostId;
    for (const p of room.players) {
      p.isHost = p.playerId === hostId;
    }
  }

  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.state = RoomState.CLOSED;
    this.codeIndex.delete(room.roomCode);
    this.rooms.delete(roomId);
  }

  selectNewHost(roomId: string): string | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const human = room.players.find(
      (p) => !p.isBot && p.playerState !== PlayerState.LEFT && p.playerState !== PlayerState.DISCONNECTED,
    );
    return human?.playerId;
  }

  getAllRooms(): ServerRoom[] {
    return [...this.rooms.values()];
  }
}

export const roomManager = new RoomManager();

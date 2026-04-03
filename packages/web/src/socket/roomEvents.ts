import type { Socket } from 'socket.io-client';
import { ROOM_EVENTS } from '@poker/shared';
import { useRoomStore } from '../stores/roomStore.js';

export function bindRoomEvents(socket: Socket) {
  socket.on(ROOM_EVENTS.JOINED, ({ room, player }) => {
    useRoomStore.getState().setRoom(room);
  });

  socket.on(ROOM_EVENTS.PLAYER_JOINED, ({ player }) => {
    useRoomStore.getState().addPlayer(player);
  });

  socket.on(ROOM_EVENTS.PLAYER_LEFT, ({ playerId, newHostId }) => {
    useRoomStore.getState().removePlayer(playerId);
    if (newHostId) {
      useRoomStore.getState().setHost(newHostId);
    }
  });

  socket.on(ROOM_EVENTS.READY_CHANGED, ({ playerId, isReady }) => {
    useRoomStore.getState().updatePlayerReady(playerId, isReady);
  });

  socket.on(ROOM_EVENTS.CONFIG_CHANGED, ({ config }) => {
    useRoomStore.getState().setConfig(config);
  });

  socket.on(ROOM_EVENTS.BOT_ADDED, ({ player }) => {
    useRoomStore.getState().addPlayer(player);
  });

  socket.on(ROOM_EVENTS.HOST_CHANGED, ({ newHostId }) => {
    useRoomStore.getState().setHost(newHostId);
  });

  socket.on(ROOM_EVENTS.KICKED, () => {
    useRoomStore.getState().clearRoom();
    window.location.href = '/';
  });

  socket.on(ROOM_EVENTS.CLOSED, () => {
    useRoomStore.getState().clearRoom();
  });
}

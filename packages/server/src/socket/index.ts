import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../auth/jwt.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import {
  SOCKET_RATE_LIMIT_EVENTS,
  SOCKET_RATE_LIMIT_WINDOW_MS,
} from '@poker/shared';

export function createSocketServer(httpServer: HttpServer, corsOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    // Rate limiting
    let eventCount = 0;
    let windowStart = Date.now();

    socket.use((_event, next) => {
      const now = Date.now();
      if (now - windowStart > SOCKET_RATE_LIMIT_WINDOW_MS) {
        eventCount = 0;
        windowStart = now;
      }
      eventCount++;
      if (eventCount > SOCKET_RATE_LIMIT_EVENTS) {
        socket.disconnect();
        return;
      }
      next();
    });

    const roomCtrl = registerRoomHandlers(io, socket, user);
    registerGameHandlers(io, socket, user.userId);

    // Join room on connection (roomId passed in query)
    const roomId = socket.handshake.query.roomId as string | undefined;
    if (roomId) {
      roomCtrl.joinRoom(roomId);
    }

    socket.on('disconnect', () => {
      roomCtrl.leaveRoom();
    });
  });

  return io;
}

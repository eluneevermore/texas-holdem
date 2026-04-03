import { io, Socket } from 'socket.io-client';
import { ROOM_EVENTS, GAME_EVENTS } from '@poker/shared';
import { getState, setState } from '../store/appStore.js';

let socket: Socket | null = null;

export function connectSocket(serverUrl: string, token: string, roomId?: string): Socket {
  socket = io(serverUrl, {
    auth: { token },
    query: roomId ? { roomId } : {},
    reconnection: true,
    reconnectionAttempts: 10,
  });

  // Room events
  socket.on(ROOM_EVENTS.JOINED, ({ room }) => {
    setState({
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostId: room.hostId,
      roomState: room.state,
      config: room.config,
      players: room.players,
    });
  });

  socket.on(ROOM_EVENTS.PLAYER_JOINED, ({ player }) => {
    const s = getState();
    setState({ players: [...s.players, player] });
    setState({ messages: [...s.messages, `${player.displayName} joined`] });
  });

  socket.on(ROOM_EVENTS.PLAYER_LEFT, ({ playerId, newHostId }) => {
    const s = getState();
    const left = s.players.find((p) => p.playerId === playerId);
    setState({ players: s.players.filter((p) => p.playerId !== playerId) });
    if (newHostId) setState({ hostId: newHostId });
    if (left) setState({ messages: [...s.messages, `${left.displayName} left`] });
  });

  socket.on(ROOM_EVENTS.READY_CHANGED, ({ playerId, isReady }) => {
    const s = getState();
    setState({
      players: s.players.map((p) =>
        p.playerId === playerId ? { ...p, isReady } : p,
      ),
    });
  });

  socket.on(ROOM_EVENTS.CONFIG_CHANGED, ({ config }) => {
    setState({ config });
  });

  socket.on(ROOM_EVENTS.BOT_ADDED, ({ player }) => {
    const s = getState();
    setState({ players: [...s.players, player] });
    setState({ messages: [...s.messages, `${player.displayName} (bot) added`] });
  });

  socket.on(ROOM_EVENTS.HOST_CHANGED, ({ newHostId }) => {
    setState({ hostId: newHostId });
    const s = getState();
    setState({
      players: s.players.map((p) => ({ ...p, isHost: p.playerId === newHostId })),
    });
  });

  socket.on(ROOM_EVENTS.KICKED, () => {
    setState({ messages: [...getState().messages, 'You were kicked from the room'] });
  });

  // Game events
  socket.on(GAME_EVENTS.START, ({ handId, handNumber, dealerSeatIndex }) => {
    setState({
      handId, handNumber, dealerSeatIndex,
      phase: 'PRE_FLOP',
      communityCards: [], holeCards: [],
      pots: [], winners: [],
    });
  });

  socket.on(GAME_EVENTS.DEAL_HOLE_CARDS, ({ cards }) => {
    setState({ holeCards: cards });
  });

  socket.on(GAME_EVENTS.PHASE_CHANGE, ({ phase, communityCards }) => {
    setState({ phase, communityCards });
  });

  socket.on(GAME_EVENTS.TURN_START, (data) => {
    setState({
      turnPlayerId: data.playerId,
      turnSecondsRemaining: 30,
      turnCanCheck: data.canCheck,
      turnCanRaise: data.canRaise,
      turnCallAmount: data.callAmount,
      turnMinRaise: data.minRaise,
    });
  });

  socket.on(GAME_EVENTS.TIMER_TICK, ({ secondsRemaining }) => {
    setState({ turnSecondsRemaining: secondsRemaining });
  });

  socket.on(GAME_EVENTS.ACTION_BROADCAST, ({ playerId, action }) => {
    const s = getState();
    const player = s.players.find((p) => p.playerId === playerId);
    const name = player?.displayName ?? playerId;
    const msg = action.amount
      ? `${name} ${action.type.toLowerCase()}s ${action.amount}`
      : `${name} ${action.type.toLowerCase()}s`;
    setState({
      turnPlayerId: null,
      messages: [...s.messages.slice(-20), msg],
    });
  });

  socket.on(GAME_EVENTS.POT_UPDATE, ({ pots }) => {
    setState({ pots });
  });

  socket.on(GAME_EVENTS.HAND_RESULT, ({ winners }) => {
    setState({ winners, handId: null, turnPlayerId: null });
  });

  return socket;
}

export function getSocket(): Socket | null { return socket; }

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

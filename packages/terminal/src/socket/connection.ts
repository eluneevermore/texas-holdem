import { io, Socket } from 'socket.io-client';
import { ROOM_EVENTS, GAME_EVENTS } from '@poker/shared';
import type { GamePublicState } from '@poker/shared';
import { getState, setState } from '../store/appStore.js';

let socket: Socket | null = null;

function resolvePlayerName(playerId: string): string {
  return getState().players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
}

interface ConnectSocketOptions {
  roomId?: string;
  onJoined?: () => void;
  onConnectError?: (message: string) => void;
}

export function connectSocket(serverUrl: string, token: string, options: ConnectSocketOptions = {}): Socket {
  socket = io(serverUrl, {
    auth: { token },
    query: options.roomId ? { roomId: options.roomId } : {},
    reconnection: true,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    setState({ messages: [...getState().messages.slice(-20), `socket connected ${socket?.id ?? ''}`] });
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
    setState({ messages: [...getState().messages.slice(-20), `joined room ${room.roomCode}`] });
    options.onJoined?.();
  });

  socket.on('connect_error', (error) => {
    setState({ messages: [...getState().messages.slice(-20), `socket error: ${error.message}`] });
    options.onConnectError?.(error.message);
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

  /** Authoritative game snapshot (same as web client). Keeps chips/pot/turn in sync. */
  socket.on(GAME_EVENTS.STATE_UPDATE, (gs: GamePublicState) => {
    const s = getState();
    const mergedPlayers = s.players.map((rp) => {
      const gp = gs.players.find((p) => p.playerId === rp.playerId);
      return gp ? { ...rp, chips: gp.chips } : rp;
    });
    const active = gs.activePlayerId;
    const actions = gs.activePlayerActions;
    const isMyTurn = active != null && active === s.userId;
    const secLeft = gs.activePlayerTimeoutAt
      ? Math.max(0, Math.ceil((gs.activePlayerTimeoutAt - Date.now()) / 1000))
      : 0;

    setState({
      handId: gs.handId,
      handNumber: gs.handNumber,
      phase: gs.phase,
      communityCards: gs.communityCards,
      pots: gs.pots,
      dealerSeatIndex: gs.dealerSeatIndex,
      players: mergedPlayers,
      turnPlayerId: active,
      turnSecondsRemaining: secLeft,
      turnCanCheck: isMyTurn && !!actions?.canCheck,
      turnCanRaise: isMyTurn && !!actions?.canRaise,
      turnCallAmount: isMyTurn && actions ? actions.callAmount : 0,
      turnMinRaise: isMyTurn && actions ? actions.minRaise : 0,
    });

    if (gs.winners && gs.winners.length > 0) {
      setState({
        winners: gs.winners.map((w) => ({
          playerId: w.playerId,
          displayName: resolvePlayerName(w.playerId),
          amount: w.amount,
          handRank: w.handRank,
        })),
        handId: null,
        turnPlayerId: null,
      });
    }
  });

  // Game events (legacy — still emitted alongside STATE_UPDATE)
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
    setState({
      winners: winners.map((winner: { playerId: string; amount: number; handRank?: string }) => ({
        ...winner,
        displayName: resolvePlayerName(winner.playerId),
      })),
      handId: null,
      turnPlayerId: null,
    });
  });

  return socket;
}

export function getSocket(): Socket | null { return socket; }

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

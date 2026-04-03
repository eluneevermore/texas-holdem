#!/usr/bin/env node

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text } from 'ink';
import { ROOM_EVENTS, GAME_EVENTS } from '@poker/shared';
import { connectSocket, getSocket, disconnectSocket } from '../socket/connection.js';
import { getState, setState, resetState } from '../store/appStore.js';
import LobbyScreen from '../screens/LobbyScreen.js';
import WaitingRoomScreen from '../screens/WaitingRoomScreen.js';
import GameTableScreen from '../screens/GameTableScreen.js';
import SummaryScreen from '../screens/SummaryScreen.js';

const SERVER_URL = process.env.POKER_SERVER_URL || 'http://localhost:3001';

type Screen = 'auth' | 'lobby' | 'waiting' | 'game' | 'summary';

function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  // Re-render on state changes via polling
  useEffect(() => {
    const interval = setInterval(forceUpdate, 500);
    return () => clearInterval(interval);
  }, [forceUpdate]);

  const state = getState();

  // Auto-login as guest for now
  useEffect(() => {
    async function login() {
      const isGuest = process.argv.includes('--guest') || !process.argv.includes('login');
      try {
        const res = await fetch(`${SERVER_URL}/auth/guest`, { method: 'POST' });
        const data = await res.json() as { guestId: string; displayName: string; accessToken: string };
        setState({
          token: data.accessToken,
          userId: data.guestId,
          displayName: data.displayName,
          isGuest: true,
        });
        setScreen('lobby');
      } catch {
        setState({ messages: [...getState().messages, 'Failed to connect to server'] });
      }
    }
    login();
  }, []);

  // Watch for game state transitions
  useEffect(() => {
    if (state.handId && screen !== 'game') setScreen('game');
    if (!state.handId && state.winners.length > 0 && screen !== 'summary') setScreen('summary');
    if (state.winners.length > 0) {
      const timeout = setTimeout(() => {
        setState({ winners: [] });
        if (state.roomId) setScreen('game');
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [state.handId, state.winners.length, screen, state.roomId]);

  const handleCreateRoom = async () => {
    if (!state.token) return;
    try {
      const res = await fetch(`${SERVER_URL}/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      });
      const { roomId, roomCode } = await res.json() as { roomId: string; roomCode: string };
      connectSocket(SERVER_URL, state.token, roomId);
      setScreen('waiting');
    } catch {
      setState({ messages: [...state.messages, 'Failed to create room'] });
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!state.token) return;
    try {
      const res = await fetch(`${SERVER_URL}/rooms/${code}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      });
      const { roomId } = await res.json() as { roomId: string };
      connectSocket(SERVER_URL, state.token, roomId);
      setScreen('waiting');
    } catch {
      setState({ messages: [...state.messages, 'Failed to join room'] });
    }
  };

  const handleQuit = () => {
    disconnectSocket();
    process.exit(0);
  };

  if (screen === 'auth') {
    return (
      <Box padding={1}>
        <Text color="gray">Connecting to server...</Text>
      </Box>
    );
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        displayName={state.displayName || 'Guest'}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onQuit={handleQuit}
      />
    );
  }

  if (screen === 'waiting' && state.config && state.roomCode) {
    return (
      <WaitingRoomScreen
        roomCode={state.roomCode}
        config={state.config}
        players={state.players}
        userId={state.userId || ''}
        isHost={state.hostId === state.userId}
        onReady={() => getSocket()?.emit(ROOM_EVENTS.READY_TOGGLE)}
        onAddBot={() => getSocket()?.emit(ROOM_EVENTS.ADD_BOT)}
        onLeave={handleQuit}
      />
    );
  }

  if (screen === 'summary') {
    return (
      <SummaryScreen
        handNumber={state.handNumber}
        winners={state.winners}
      />
    );
  }

  if (screen === 'game') {
    return (
      <GameTableScreen
        handNumber={state.handNumber}
        phase={state.phase || 'PRE_FLOP'}
        communityCards={state.communityCards}
        holeCards={state.holeCards}
        pots={state.pots}
        players={state.players}
        dealerSeatIndex={state.dealerSeatIndex}
        userId={state.userId || ''}
        turnPlayerId={state.turnPlayerId}
        turnSecondsRemaining={state.turnSecondsRemaining}
        turnCanCheck={state.turnCanCheck}
        turnCanRaise={state.turnCanRaise}
        turnCallAmount={state.turnCallAmount}
        turnMinRaise={state.turnMinRaise}
        messages={state.messages}
      />
    );
  }

  return (
    <Box padding={1}>
      <Text color="gray">Loading...</Text>
    </Box>
  );
}

const isInteractive = process.stdin.isTTY ?? false;

render(<App />, {
  ...(isInteractive ? {} : { stdin: undefined }),
});

#!/usr/bin/env node

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, type Instance } from 'ink';
import { ROOM_EVENTS } from '@poker/shared';
import { connectSocket, getSocket, disconnectSocket } from '../socket/connection.js';
import { getState, setState } from '../store/appStore.js';
import AuthScreen from '../screens/AuthScreen.js';
import LobbyScreen from '../screens/LobbyScreen.js';
import WaitingRoomScreen from '../screens/WaitingRoomScreen.js';
import GameTableScreen from '../screens/GameTableScreen.js';
import SummaryScreen from '../screens/SummaryScreen.js';
import { createGoogleSession, createGuestSession } from './auth.js';

const SERVER_URL = process.env.POKER_SERVER_URL || 'http://localhost:3001';

type Screen = 'auth' | 'auth-error' | 'lobby' | 'connecting-room' | 'waiting' | 'game' | 'summary';

const AUTH_TIMEOUT_MS = 5_000;
const GOOGLE_AUTH_TIMEOUT_MS = 120_000;
let inkApp: Instance | null = null;
let cleanedUp = false;

function cleanupAndExit(exitCode = 0) {
  if (cleanedUp) return;
  cleanedUp = true;
  disconnectSocket();
  inkApp?.unmount();
  process.exit(exitCode);
}

function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [authMessage, setAuthMessage] = useState('Choose how you want to sign in.');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  // Re-render on state changes via polling
  useEffect(() => {
    const interval = setInterval(forceUpdate, 500);
    return () => clearInterval(interval);
  }, [forceUpdate]);

  const state = getState();

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
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to create room with status ${res.status}`);
      }
      const { roomId, roomCode } = await res.json() as { roomId: string; roomCode: string };
      setScreen('connecting-room');
      connectSocket(SERVER_URL, state.token, {
        roomId,
        onJoined: () => setScreen('waiting'),
        onConnectError: () => {
          setState({ messages: [...getState().messages, `Failed to join room ${roomCode}`] });
          setScreen('lobby');
        },
      });
    } catch {
      setState({ messages: [...state.messages, 'Failed to create room'] });
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!state.token) return;
    try {
      const res = await fetch(`${SERVER_URL}/rooms/${code}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to join room with status ${res.status}`);
      }
      const { roomId } = await res.json() as { roomId: string };
      setScreen('connecting-room');
      connectSocket(SERVER_URL, state.token, {
        roomId,
        onJoined: () => setScreen('waiting'),
        onConnectError: () => {
          setState({ messages: [...getState().messages, `Failed to join room ${code}`] });
          setScreen('lobby');
        },
      });
    } catch {
      setState({ messages: [...state.messages, 'Failed to join room'] });
    }
  };

  const handleQuit = () => {
    cleanupAndExit(0);
  };

  const handleGuestLogin = async () => {
    setAuthStatus('loading');
    setAuthUrl(null);
    setAuthMessage('Connecting to server...');
    try {
      const data = await createGuestSession(SERVER_URL, AUTH_TIMEOUT_MS);
      setState({
        token: data.accessToken,
        userId: data.guestId,
        displayName: data.displayName,
        isGuest: true,
      });
      setScreen('lobby');
    } catch {
      const message = `Failed to connect to server at ${SERVER_URL}`;
      setAuthError(message);
      setAuthMessage(message);
      setAuthStatus('error');
      setState({ messages: [...getState().messages, message] });
      setScreen('auth-error');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthStatus('loading');
    setAuthUrl(null);
    setAuthMessage('Open this URL in your browser to sign in with Google:');
    try {
      const data = await createGoogleSession(
        SERVER_URL,
        GOOGLE_AUTH_TIMEOUT_MS,
        fetch,
        (loginUrl) => setAuthUrl(loginUrl),
      );
      setState({
        token: data.accessToken,
        userId: data.userId,
        displayName: data.displayName,
        isGuest: false,
      });
      setScreen('lobby');
    } catch {
      const message = `Google login failed or timed out for ${SERVER_URL}`;
      setAuthError(message);
      setAuthMessage(message);
      setAuthStatus('error');
      setState({ messages: [...getState().messages, message] });
      setScreen('auth-error');
    }
  };

  if (screen === 'auth' || screen === 'auth-error') {
    return (
      <AuthScreen
        status={screen === 'auth-error' ? 'error' : authStatus}
        message={screen === 'auth-error' ? (authError || authMessage) : authMessage}
        authUrl={authUrl}
        onGuest={handleGuestLogin}
        onGoogle={handleGoogleLogin}
        onQuit={handleQuit}
      />
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

  if (screen === 'connecting-room') {
    return (
      <Box padding={1}>
        <Text color="gray">Joining room...</Text>
      </Box>
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

inkApp = render(<App />, {
  ...(isInteractive ? {} : { stdin: undefined }),
});

process.once('SIGINT', () => cleanupAndExit(0));
process.once('SIGTERM', () => cleanupAndExit(0));
process.once('exit', () => {
  if (!cleanedUp) {
    cleanedUp = true;
    disconnectSocket();
    inkApp?.unmount();
  }
});

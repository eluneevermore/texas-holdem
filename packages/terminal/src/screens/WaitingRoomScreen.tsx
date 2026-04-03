import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { RoomConfig, RoomPlayer } from '@poker/shared';

interface Props {
  roomCode: string;
  config: RoomConfig;
  players: RoomPlayer[];
  userId: string;
  isHost: boolean;
  onReady: () => void;
  onAddBot: () => void;
  onLeave: () => void;
}

export default function WaitingRoomScreen({
  roomCode, config, players, userId, isHost, onReady, onAddBot, onLeave,
}: Props) {
  useInput((input) => {
    if (input === 'r' || input === 'R') onReady();
    if (isHost && (input === 'a' || input === 'A')) onAddBot();
    if (input === 'q' || input === 'Q') onLeave();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold>Room: <Text color="cyan">{roomCode}</Text></Text>
        <Text color="gray">
          Blinds: {config.smallBlind}/{config.bigBlind}   Stack: {config.initialStack}   Buy-in: {config.buyInAllowed ? 'ON' : 'OFF'}
        </Text>
        <Text> </Text>

        <Text bold>
          {'  Seat  Player            Chips    Ready'}
        </Text>
        <Text color="gray">
          {'  ────  ──────────────    ─────    ─────'}
        </Text>

        {players.map((p) => (
          <Text key={p.playerId}>
            {'  '}[{p.seatIndex + 1}]   {formatName(p, userId).padEnd(18)} {String(p.chips).padStart(5)}    {p.isReady ? '\u2713' : '\u2717'}
          </Text>
        ))}

        <Text> </Text>
        <Text> [R] Toggle Ready  {isHost ? '[A] Add Bot  ' : ''}[Q] Leave</Text>
      </Box>
    </Box>
  );
}

function formatName(p: RoomPlayer, userId: string): string {
  let name = p.displayName;
  if (p.playerId === userId) name += ' (you)';
  if (p.isHost) name += ' HOST';
  if (p.isBot) name += ' [BOT]';
  return name;
}

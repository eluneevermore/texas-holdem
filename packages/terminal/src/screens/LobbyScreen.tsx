import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  displayName: string;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onQuit: () => void;
}

export default function LobbyScreen({ displayName, onCreateRoom, onJoinRoom, onQuit }: Props) {
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');

  useInput((input, key) => {
    if (mode === 'menu') {
      if (input === '1') onCreateRoom();
      if (input === '2') setMode('join');
      if (input === 'q' || input === 'Q') onQuit();
    } else if (mode === 'join') {
      if (key.escape) {
        setMode('menu');
        setJoinCode('');
      } else if (key.return && joinCode.length === 6) {
        onJoinRoom(joinCode);
      } else if (key.backspace || key.delete) {
        setJoinCode((c) => c.slice(0, -1));
      } else if (/^[A-Za-z0-9]$/.test(input) && joinCode.length < 6) {
        setJoinCode((c) => c + input.toUpperCase());
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="yellow">POKER</Text>
        <Text color="gray">Signed in as: {displayName}</Text>
        <Text> </Text>

        {mode === 'menu' ? (
          <>
            <Text> [1] Create Room</Text>
            <Text> [2] Join Room</Text>
            <Text> [Q] Quit</Text>
          </>
        ) : (
          <>
            <Text>Enter 6-character room code:</Text>
            <Text bold color="cyan">{joinCode}{'_'.repeat(6 - joinCode.length)}</Text>
            <Text color="gray">[Enter] Join  [Esc] Back</Text>
          </>
        )}
      </Box>
    </Box>
  );
}

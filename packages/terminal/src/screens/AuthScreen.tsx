import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  status: 'idle' | 'loading' | 'error';
  message: string;
  authUrl?: string | null;
  onGuest: () => void;
  onGoogle: () => void;
  onQuit: () => void;
}

export default function AuthScreen({
  status,
  message,
  authUrl,
  onGuest,
  onGoogle,
  onQuit,
}: Props) {
  useInput((input) => {
    if (status === 'loading') {
      if (input === 'q' || input === 'Q') onQuit();
      return;
    }

    if (input === '1') onGuest();
    if (input === '2') onGoogle();
    if (input === 'q' || input === 'Q') onQuit();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="yellow">POKER</Text>
        <Text> </Text>

        {status !== 'loading' ? (
          <>
            <Text>[1] Play as Guest</Text>
            <Text>[2] Sign in with Google</Text>
            <Text>[Q] Quit</Text>
          </>
        ) : null}

        {status !== 'idle' ? (
          <>
            <Text color={status === 'error' ? 'red' : 'gray'}>{message}</Text>
            {authUrl ? <Text color="cyan">{authUrl}</Text> : null}
            {status === 'loading' && authUrl ? (
              <Text color="gray">Waiting up to 120 seconds for the browser callback...</Text>
            ) : null}
          </>
        ) : null}
      </Box>
    </Box>
  );
}

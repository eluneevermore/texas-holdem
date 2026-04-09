import React from 'react';
import { Box, Text } from 'ink';

interface Winner {
  playerId: string;
  displayName?: string;
  amount: number;
  handRank?: string;
}

interface Props {
  handNumber: number;
  winners: Winner[];
}

export default function SummaryScreen({ handNumber, winners }: Props) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold>Hand #{handNumber} Result</Text>
        <Text> </Text>
        {winners.map((w, i) => (
          <Box key={i} flexDirection="column">
            <Text bold color="yellow">
              {w.displayName || w.playerId} wins {w.amount} chips
            </Text>
            {w.handRank && <Text color="gray">  with: {w.handRank}</Text>}
          </Box>
        ))}
        <Text> </Text>
        <Text color="gray">Next hand starting soon...</Text>
      </Box>
    </Box>
  );
}

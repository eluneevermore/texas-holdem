import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Card, RoomPlayer, Pot } from '@poker/shared';
import { GAME_EVENTS } from '@poker/shared';
import { getSocket } from '../socket/connection.js';

const SUIT_SYM: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};
const PLAYER_NAME_WIDTH = 24;

interface Props {
  handNumber: number;
  phase: string;
  communityCards: Card[];
  holeCards: Card[];
  pots: Pot[];
  players: RoomPlayer[];
  dealerSeatIndex: number;
  userId: string;
  turnPlayerId: string | null;
  turnSecondsRemaining: number;
  turnCanCheck: boolean;
  turnCanRaise: boolean;
  turnCallAmount: number;
  turnMinRaise: number;
  messages: string[];
}

export default function GameTableScreen(props: Props) {
  const {
    handNumber, phase, communityCards, holeCards, pots,
    players, dealerSeatIndex, userId,
    turnPlayerId, turnSecondsRemaining, turnCanCheck, turnCanRaise,
    turnCallAmount, turnMinRaise, messages,
  } = props;

  const isMyTurn = turnPlayerId === userId;
  const [raiseMode, setRaiseMode] = useState(false);
  const [raiseInput, setRaiseInput] = useState('');

  useInput((input, key) => {
    if (!isMyTurn) return;
    const socket = getSocket();

    if (raiseMode) {
      if (key.escape) { setRaiseMode(false); setRaiseInput(''); }
      else if (key.return && raiseInput.length > 0) {
        const amount = Number(raiseInput);
        socket?.emit(GAME_EVENTS.ACTION, { type: 'RAISE', amount });
        setRaiseMode(false);
        setRaiseInput('');
      }
      else if (key.backspace || key.delete) setRaiseInput((c) => c.slice(0, -1));
      else if (/^[0-9]$/.test(input)) setRaiseInput((c) => c + input);
      return;
    }

    if (input === 'f' || input === 'F') socket?.emit(GAME_EVENTS.ACTION, { type: 'FOLD' });
    if (input === 'c' || input === 'C') {
      socket?.emit(GAME_EVENTS.ACTION, { type: turnCanCheck ? 'CHECK' : 'CALL' });
    }
    if ((input === 'r' || input === 'R') && turnCanRaise) setRaiseMode(true);
    if (input === 'a' || input === 'A') socket?.emit(GAME_EVENTS.ACTION, { type: 'ALL_IN' });
  });

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold>Hand #{handNumber} — Pot: {totalPot}</Text>
        <Text> </Text>

        {/* Community cards */}
        <Text>
          {'  Community: '}
          {Array.from({ length: 5 }).map((_, i) => {
            const card = communityCards[i];
            return (
              <Text key={i}>
                {card ? <CardText card={card} /> : '[ ? ]'}
              </Text>
            );
          })}
        </Text>
        <Text> </Text>

        {/* Player table */}
        <Text bold>
          {'  Seat  Player                    Chips   Bet   Role'}
        </Text>
        <Text color="gray">
          {'  ────  ──────────────────────── ─────   ───   ────'}
        </Text>
        {players.map((p) => {
          const role = getRoleLabel(p, dealerSeatIndex, players);
          const isActive = turnPlayerId === p.playerId;
          return (
            <Text key={p.playerId} color={isActive ? 'cyan' : undefined}>
              {'  '}[{p.seatIndex + 1}]   {formatPlayerName(p, userId, PLAYER_NAME_WIDTH)} {String(p.chips).padStart(5)}   {'---'.padStart(3)}   {role}
            </Text>
          );
        })}

        {/* Hole cards */}
        <Text> </Text>
        <Text>
          {'  Your cards: '}
          {holeCards.map((card, i) => (
            <Text key={i}>
              <CardText card={card} />
            </Text>
          ))}
        </Text>
        <Text>  Phase: {phase}  {isMyTurn ? `— Your turn! (${turnSecondsRemaining}s)` : ''}</Text>
        <Text> </Text>

        {/* Actions */}
        {isMyTurn && !raiseMode && (
          <Text>
            {'  '}[F] Fold   [{turnCanCheck ? 'C] Check' : `C] Call ${turnCallAmount}`}   {turnCanRaise ? '[R] Raise   ' : ''}[A] All-in
          </Text>
        )}
        {raiseMode && (
          <Text>
            {'  '}Raise amount (min {turnMinRaise}): {raiseInput || '_'}  [Enter] Confirm  [Esc] Cancel
          </Text>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <>
            <Text> </Text>
            {messages.slice(-5).map((m, i) => (
              <Text key={i} color="gray">{'  '}{m}</Text>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

function formatPlayerName(p: RoomPlayer, userId: string, width: number): string {
  let name = p.displayName;
  if (p.playerId === userId) name += ' (you)';
  return truncateAndPad(name, width);
}

function truncateAndPad(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  if (width <= 3) return '.'.repeat(width);
  return `${value.slice(0, width - 3)}...`;
}

function CardText({ card }: { card: Card }) {
  const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : undefined;
  return (
    <Text>
      {'['}
      {card.rank}
      <Text color={suitColor}>{SUIT_SYM[card.suit]}</Text>
      {']'}
    </Text>
  );
}

function getRoleLabel(p: RoomPlayer, dealerSeat: number, players: RoomPlayer[]): string {
  const n = players.length;
  const isHeadsUp = n === 2;
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const dealerIdx = sorted.findIndex((pl) => pl.seatIndex === dealerSeat);

  const sbIdx = isHeadsUp ? dealerIdx : (dealerIdx + 1) % n;
  const bbIdx = isHeadsUp ? (dealerIdx + 1) % n : (dealerIdx + 2) % n;
  const pIdx = sorted.findIndex((pl) => pl.playerId === p.playerId);

  const parts: string[] = [];
  if (p.seatIndex === dealerSeat) parts.push('D');
  if (pIdx === sbIdx) parts.push('SB');
  if (pIdx === bbIdx) parts.push('BB');

  if (p.playerState === 'FOLDED') return 'FOLD';
  if (p.playerState === 'ALL_IN') return 'ALL-IN';
  return parts.join('/') || '';
}

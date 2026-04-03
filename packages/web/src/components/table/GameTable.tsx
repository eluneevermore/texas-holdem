import { useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import type { GamePlayerPublicState, Card } from '@poker/shared';
import { PlayerState } from '@poker/shared';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import ActionPanel from './ActionPanel';
import BuyInButton from '../common/BuyInButton';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

export default function GameTable() {
  const gs = useGameStore((s) => s.publicState);
  const holeCards = useGameStore((s) => s.holeCards);
  const timerSeconds = useGameStore((s) => s.timerSecondsRemaining);
  const userId = useAuthStore((s) => s.userId);
  const roomPlayers = useRoomStore((s) => s.players);

  if (!gs) return null;

  const meInHand = gs.players.find((p) => p.playerId === userId);
  const meInRoom = roomPlayers.find((p) => p.playerId === userId);
  const isObserver = !meInHand || meInRoom?.playerState === PlayerState.OBSERVER;
  const isMyTurn = gs.activePlayerId === userId;

  const winMap = useMemo(() => {
    const m = new Map<string, { amount: number; handRank?: string }>();
    if (!gs.winners) return m;
    for (const w of gs.winners) {
      const prev = m.get(w.playerId);
      m.set(w.playerId, {
        amount: (prev?.amount ?? 0) + w.amount,
        handRank: w.handRank ?? prev?.handRank,
      });
    }
    return m;
  }, [gs.winners]);

  const showdownMap = useMemo(() => {
    const m = new Map<string, { cards: Card[]; handRank: string }>();
    if (!gs.showdown) return m;
    for (const s of gs.showdown) {
      if (!s.mucked) m.set(s.playerId, { cards: s.holeCards, handRank: s.handRank });
    }
    return m;
  }, [gs.showdown]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Hand info bar */}
      <div style={{
        display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8',
        marginBottom: '8px',
      }}>
        <span>Hand #{gs.handNumber}</span>
        <span>{gs.phase.replace('_', ' ')}</span>
        <span>Blinds {gs.smallBlind}/{gs.bigBlind}</span>
      </div>

      {/* Table surface */}
      <div style={{
        background: 'radial-gradient(ellipse at center, #065f46 0%, #064e3b 60%, #022c22 100%)',
        borderRadius: '50%',
        width: 'min(90vw, 700px)', height: 'min(50vw, 400px)',
        position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '6px solid #1e293b',
        marginTop: '8px',
      }}>
        <CommunityCards cards={gs.communityCards} totalPot={gs.totalPot} pots={gs.pots} />

        {gs.players.map((p, i) => {
          const n = gs.players.length;
          const myIdx = gs.players.findIndex((pl) => pl.playerId === userId);
          const offset = myIdx >= 0 ? myIdx : 0;
          const angle = ((i - offset) / Math.max(n, 1)) * Math.PI * 2 + Math.PI / 2;
          const rx = 48;
          const ry = 42;
          const top = `${50 + ry * Math.sin(angle)}%`;
          const left = `${50 + rx * Math.cos(angle)}%`;

          const win = winMap.get(p.playerId);
          const sd = showdownMap.get(p.playerId);

          return (
            <div key={p.playerId} style={{
              position: 'absolute', top, left,
              transform: 'translate(-50%, -50%)',
            }}>
              <PlayerSeat
                player={p}
                timerSeconds={p.isTurn ? timerSeconds : undefined}
                isCurrentUser={p.playerId === userId}
                winAmount={win?.amount}
                winHandRank={win?.handRank}
                showdownCards={sd?.cards}
                showdownHandRank={sd?.handRank}
              />
            </div>
          );
        })}
      </div>

      {/* Hole cards — only show when participating */}
      {!isObserver && holeCards.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          {holeCards.map((card, i) => (
            <div key={i} style={{
              width: '64px', height: '92px', borderRadius: '8px',
              border: '2px solid #fbbf24', background: '#1e293b',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700,
            }}>
              <span style={{ color: SUIT_COLORS[card.suit] }}>{card.rank}</span>
              <span style={{ color: SUIT_COLORS[card.suit], fontSize: '20px' }}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action panel / observer view / waiting */}
      <div style={{ marginTop: '20px' }}>
        {isObserver ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', margin: '0 0 12px' }}>You are observing</p>
            <BuyInButton />
          </div>
        ) : isMyTurn ? (
          <ActionPanel />
        ) : (
          <WaitingMessage activePlayer={gs.players.find((p) => p.isTurn) ?? null} />
        )}
      </div>

    </div>
  );
}

function WaitingMessage({ activePlayer }: { activePlayer: GamePlayerPublicState | null }) {
  if (!activePlayer) {
    return <p style={{ color: '#64748b' }}>Waiting for next hand...</p>;
  }
  return (
    <p style={{ color: '#64748b' }}>
      Waiting for <span style={{ color: '#e5e7eb' }}>{activePlayer.displayName}</span>...
    </p>
  );
}

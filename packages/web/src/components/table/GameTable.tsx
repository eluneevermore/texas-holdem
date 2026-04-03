import { useGameStore } from '../../stores/gameStore';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { PlayerState } from '@poker/shared';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import ActionPanel from './ActionPanel';
import HandResultOverlay from './HandResultOverlay';
import BuyInButton from '../common/BuyInButton';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

export default function GameTable() {
  const players = useRoomStore((s) => s.players);
  const userId = useAuthStore((s) => s.userId);
  const {
    communityCards, holeCards, pots, turn, dealerSeatIndex, playerChips, winners,
  } = useGameStore();

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  const currentPlayer = players.find((p) => p.playerId === userId);
  const isObserver = currentPlayer?.playerState === PlayerState.OBSERVER;
  const isMyTurn = turn?.playerId === userId;

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Table surface */}
      <div style={{
        background: 'radial-gradient(ellipse at center, #065f46 0%, #064e3b 60%, #022c22 100%)',
        borderRadius: '50%',
        width: 'min(90vw, 700px)', height: 'min(50vw, 400px)',
        position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '6px solid #1e293b',
        marginTop: '20px',
      }}>
        <CommunityCards cards={communityCards} pot={totalPot} />

        {/* Player seats around the table */}
        {players.map((p, i) => {
          const angle = (i / Math.max(players.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const rx = 48;
          const ry = 42;
          const top = `${50 + ry * Math.sin(angle)}%`;
          const left = `${50 + rx * Math.cos(angle)}%`;
          const chipInfo = playerChips.find((c) => c.playerId === p.playerId);

          return (
            <div key={p.playerId} style={{
              position: 'absolute', top, left,
              transform: 'translate(-50%, -50%)',
            }}>
              <PlayerSeat
                player={p}
                currentBet={chipInfo?.currentBet ?? 0}
                isDealer={p.seatIndex === dealerSeatIndex}
                isTurn={turn?.playerId === p.playerId}
                secondsRemaining={turn?.playerId === p.playerId ? turn.secondsRemaining : undefined}
                isCurrentUser={p.playerId === userId}
              />
            </div>
          );
        })}
      </div>

      {/* Hole cards */}
      {holeCards.length > 0 && (
        <div style={{
          display: 'flex', gap: '8px', marginTop: '20px',
        }}>
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

      {/* Action panel or observer view */}
      <div style={{ marginTop: '20px' }}>
        {isObserver ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>You are observing</p>
            <BuyInButton />
          </div>
        ) : isMyTurn ? (
          <ActionPanel />
        ) : (
          <p style={{ color: '#64748b' }}>
            {turn ? `Waiting for ${turn.playerId}...` : 'Waiting for next hand...'}
          </p>
        )}
      </div>

      <HandResultOverlay />
    </div>
  );
}

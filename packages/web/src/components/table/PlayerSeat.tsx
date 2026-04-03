import { useState, useEffect, useRef } from 'react';
import type { GamePlayerPublicState, Card } from '@poker/shared';
import { HandState } from '@poker/shared';

interface Props {
  player: GamePlayerPublicState;
  timerSeconds?: number | null;
  isCurrentUser: boolean;
  winAmount?: number | null;
  winHandRank?: string | null;
  showdownCards?: Card[] | null;
  showdownHandRank?: string | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

const ACTION_LABELS: Record<string, string> = {
  FOLD: 'Fold',
  CHECK: 'Check',
  CALL: 'Call',
  RAISE: 'Raise',
  ALL_IN: 'ALL IN!',
};

const ACTION_COLORS: Record<string, string> = {
  FOLD: '#ef4444',
  CHECK: '#3b82f6',
  CALL: '#3b82f6',
  RAISE: '#16a34a',
  ALL_IN: '#dc2626',
};

export default function PlayerSeat({
  player, timerSeconds, isCurrentUser,
  winAmount, winHandRank, showdownCards, showdownHandRank,
}: Props) {
  const isFolded = player.handState === HandState.FOLDED;
  const isAllIn = player.handState === HandState.ALL_IN;
  const isWinner = winAmount != null && winAmount > 0;

  // Action bubble state — shows briefly then fades out
  const [bubble, setBubble] = useState<{ text: string; color: string } | null>(null);
  const prevActionRef = useRef<string | null>(null);

  useEffect(() => {
    const key = player.lastAction
      ? `${player.lastAction.type}:${player.lastAction.amount}`
      : null;

    if (key && key !== prevActionRef.current) {
      const type = player.lastAction!.type;
      const amount = player.lastAction!.amount;
      const label = ACTION_LABELS[type] ?? type;
      const text = amount > 0 ? `${label} ${amount}` : label;
      const color = ACTION_COLORS[type] ?? '#94a3b8';

      setBubble({ text, color });

      const timer = setTimeout(() => setBubble(null), 2500);
      prevActionRef.current = key;
      return () => clearTimeout(timer);
    }
    if (!key) {
      prevActionRef.current = null;
    }
  }, [player.lastAction]);

  const timerUrgent = timerSeconds != null && timerSeconds <= 10;
  const timerPct = timerSeconds != null ? Math.max(0, timerSeconds) / 30 : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      padding: '10px 14px', borderRadius: '14px', minWidth: '120px',
      background: player.isTurn
        ? 'linear-gradient(135deg, #1e3a5f 0%, #1a2e4a 100%)'
        : isWinner ? 'linear-gradient(135deg, #422006 0%, #1e293b 100%)' : '#1e293b',
      border: player.isTurn
        ? '2px solid #60a5fa'
        : isWinner ? '2px solid #f59e0b' : '2px solid transparent',
      boxShadow: player.isTurn
        ? '0 0 20px rgba(96,165,250,0.5), 0 0 40px rgba(96,165,250,0.2), inset 0 0 12px rgba(96,165,250,0.1)'
        : isWinner ? '0 0 16px rgba(245,158,11,0.4)' : 'none',
      position: 'relative',
      opacity: isFolded ? 0.4 : 1,
      transition: 'box-shadow 0.3s, border-color 0.3s, opacity 0.3s',
    }}>
      {/* Turn timer ring */}
      {player.isTurn && timerSeconds != null && (
        <svg
          width="56" height="56"
          style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}
        >
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke={timerUrgent ? '#ef4444' : '#3b82f6'}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - timerPct)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            transform="rotate(-90 28 28)"
          />
        </svg>
      )}

      {/* Dealer button */}
      {player.isDealer && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: '24px', height: '24px', borderRadius: '50%',
          background: '#fbbf24', color: '#000', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
          zIndex: 2,
        }}>
          D
        </div>
      )}

      {/* Action bubble */}
      {bubble && (
        <div style={{
          position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
          background: bubble.color, color: '#fff',
          padding: '3px 12px', borderRadius: '12px',
          fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
          zIndex: 10,
          animation: 'actionBubble 2.5s ease-out forwards',
          pointerEvents: 'none',
        }}>
          {bubble.text}
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: player.isTurn ? '#2563eb' : '#374151',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '18px',
        color: player.isTurn ? '#fff' : '#9ca3af',
        fontWeight: player.isTurn ? 700 : 400,
        transition: 'background 0.3s',
        position: 'relative', zIndex: 1,
      }}>
        {player.displayName.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span style={{
        fontSize: '12px',
        color: isCurrentUser ? '#fbbf24' : player.isTurn ? '#93c5fd' : '#e5e7eb',
        fontWeight: isCurrentUser || player.isTurn ? 700 : 400,
        maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {player.displayName}
      </span>

      {/* Chips */}
      <span style={{ fontSize: '14px', color: '#fbbf24', fontWeight: 600 }}>
        {player.chips.toLocaleString()}
      </span>

      {/* Current round bet */}
      {player.currentRoundBet > 0 && (
        <span style={{
          fontSize: '12px', color: '#60a5fa', fontWeight: 600,
          background: 'rgba(30,41,59,0.9)', padding: '1px 8px', borderRadius: '8px',
          border: '1px solid #334155',
        }}>
          Bet {player.currentRoundBet}
        </span>
      )}

      {/* State label */}
      {isFolded && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>FOLDED</span>}
      {isAllIn && (
        <span style={{
          fontSize: '11px', color: '#f59e0b', fontWeight: 700,
          textShadow: '0 0 6px rgba(245,158,11,0.5)',
        }}>
          ALL IN
        </span>
      )}

      {/* Timer countdown text */}
      {player.isTurn && timerSeconds != null && (
        <div style={{
          fontSize: '12px', fontWeight: 700,
          color: timerUrgent ? '#ef4444' : '#60a5fa',
        }}>
          {timerSeconds}s
        </div>
      )}

      {/* Winner bubble */}
      {isWinner && (
        <div style={{
          position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #f59e0b, #eab308)',
          color: '#000', padding: '4px 14px', borderRadius: '12px',
          fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap',
          zIndex: 12, boxShadow: '0 2px 10px rgba(245,158,11,0.5)',
          animation: 'winBubble 4s ease-out forwards',
          pointerEvents: 'none',
        }}>
          +{winAmount!.toLocaleString()}
          {winHandRank && <span style={{ fontWeight: 600, marginLeft: '4px' }}>{winHandRank}</span>}
        </div>
      )}

      {/* Showdown hole cards */}
      {showdownCards && showdownCards.length > 0 && (
        <div style={{
          display: 'flex', gap: '3px', marginTop: '2px',
          justifyContent: 'center',
        }}>
          {showdownCards.map((card, j) => (
            <div key={j} style={{
              width: '32px', height: '44px', borderRadius: '4px',
              border: isWinner ? '2px solid #fbbf24' : '1px solid #475569',
              background: '#0f172a',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, lineHeight: 1.1,
            }}>
              <span style={{ color: SUIT_COLORS[card.suit] }}>{card.rank}</span>
              <span style={{ color: SUIT_COLORS[card.suit], fontSize: '11px' }}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
            </div>
          ))}
          {showdownHandRank && (
            <span style={{
              fontSize: '10px', color: '#94a3b8',
              alignSelf: 'center', marginLeft: '2px', whiteSpace: 'nowrap',
            }}>
              {showdownHandRank}
            </span>
          )}
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes actionBubble {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          70%  { opacity: 1; transform: translateX(-50%) translateY(-6px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-14px); }
        }
        @keyframes winBubble {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          10%  { transform: translateX(-50%) translateY(-4px) scale(1.15); }
          20%  { transform: translateX(-50%) translateY(0) scale(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

import type { GamePlayerPublicState } from '@poker/shared';
import { HandState } from '@poker/shared';

interface Props {
  player: GamePlayerPublicState;
  timerSeconds?: number | null;
  isCurrentUser: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  FOLD: 'Fold',
  CHECK: 'Check',
  CALL: 'Call',
  RAISE: 'Raise',
  ALL_IN: 'All In',
};

export default function PlayerSeat({ player, timerSeconds, isCurrentUser }: Props) {
  const isFolded = player.handState === HandState.FOLDED;
  const isAllIn = player.handState === HandState.ALL_IN;

  const lastActionLabel = player.lastAction
    ? `${ACTION_LABELS[player.lastAction.type] ?? player.lastAction.type}${
        player.lastAction.amount > 0 ? ` ${player.lastAction.amount}` : ''
      }`
    : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '12px', borderRadius: '12px', minWidth: '120px',
      background: player.isTurn ? '#1e3a5f' : '#1e293b',
      border: player.isTurn ? '2px solid #3b82f6' : '2px solid transparent',
      position: 'relative',
      opacity: isFolded ? 0.45 : 1,
    }}>
      {/* Dealer button */}
      {player.isDealer && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: '24px', height: '24px', borderRadius: '50%',
          background: '#fbbf24', color: '#000', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
        }}>
          D
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: '#374151', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '18px', color: '#9ca3af',
      }}>
        {player.displayName.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span style={{
        fontSize: '13px',
        color: isCurrentUser ? '#fbbf24' : '#e5e7eb',
        fontWeight: isCurrentUser ? 700 : 400,
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
          background: '#1e293b', padding: '1px 8px', borderRadius: '8px',
          border: '1px solid #334155',
        }}>
          Bet {player.currentRoundBet}
        </span>
      )}

      {/* Last action */}
      {lastActionLabel && !isFolded && (
        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
          {lastActionLabel}
        </span>
      )}

      {/* State label */}
      {isFolded && <span style={{ fontSize: '11px', color: '#ef4444' }}>FOLDED</span>}
      {isAllIn && <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>ALL IN</span>}

      {/* Turn timer */}
      {player.isTurn && timerSeconds != null && (
        <div style={{
          fontSize: '12px', fontWeight: 600,
          color: timerSeconds <= 10 ? '#ef4444' : '#60a5fa',
        }}>
          {timerSeconds}s
        </div>
      )}
    </div>
  );
}

import type { RoomPlayer } from '@poker/shared';
import { PlayerState } from '@poker/shared';

interface Props {
  player: RoomPlayer;
  currentBet: number;
  isDealer: boolean;
  isTurn: boolean;
  secondsRemaining?: number;
  isCurrentUser: boolean;
}

export default function PlayerSeat({
  player, currentBet, isDealer, isTurn, secondsRemaining, isCurrentUser,
}: Props) {
  const stateLabel = getStateLabel(player);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '12px', borderRadius: '12px', minWidth: '120px',
      background: isTurn ? '#1e3a5f' : '#1e293b',
      border: isTurn ? '2px solid #3b82f6' : '2px solid transparent',
      position: 'relative',
      opacity: player.playerState === PlayerState.FOLDED ? 0.5 : 1,
    }}>
      {/* Dealer button */}
      {isDealer && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: '24px', height: '24px', borderRadius: '50%',
          background: '#fbbf24', color: '#000', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
        }}>
          D
        </div>
      )}

      {/* Disconnected indicator */}
      {player.playerState === PlayerState.DISCONNECTED && (
        <div style={{
          position: 'absolute', top: -4, left: -4,
          width: '12px', height: '12px', borderRadius: '50%',
          background: '#ef4444', animation: 'pulse 1.5s infinite',
        }} />
      )}

      {/* Avatar placeholder */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: '#374151', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '20px', color: '#9ca3af',
      }}>
        {player.isBot ? '\u{1F916}' : player.displayName.charAt(0).toUpperCase()}
      </div>

      <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: isCurrentUser ? 700 : 400 }}>
        {player.displayName}
        {player.isBot && ' [BOT]'}
      </span>

      <span style={{ fontSize: '14px', color: '#fbbf24', fontWeight: 600 }}>
        {player.chips}
      </span>

      {currentBet > 0 && (
        <span style={{ fontSize: '12px', color: '#60a5fa' }}>
          Bet: {currentBet}
        </span>
      )}

      {stateLabel && (
        <span style={{ fontSize: '11px', color: '#6b7280' }}>{stateLabel}</span>
      )}

      {/* Turn timer */}
      {isTurn && secondsRemaining !== undefined && (
        <div style={{
          fontSize: '12px', fontWeight: 600,
          color: secondsRemaining <= 10 ? '#ef4444' : '#60a5fa',
        }}>
          {secondsRemaining}s
        </div>
      )}
    </div>
  );
}

function getStateLabel(player: RoomPlayer): string | null {
  switch (player.playerState) {
    case PlayerState.FOLDED: return 'FOLDED';
    case PlayerState.ALL_IN: return 'ALL IN';
    case PlayerState.OBSERVER: return 'OBSERVER';
    case PlayerState.SITTING_OUT: return 'SITTING OUT';
    case PlayerState.DISCONNECTED: return 'DISCONNECTED';
    default: return null;
  }
}

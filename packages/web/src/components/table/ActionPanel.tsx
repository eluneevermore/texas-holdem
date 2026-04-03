import { useState } from 'react';
import { GAME_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';
import { useGameStore } from '../../stores/gameStore';

export default function ActionPanel() {
  const socket = useSocketStore((s) => s.socket);
  const turn = useGameStore((s) => s.turn);
  const [raiseAmount, setRaiseAmount] = useState(0);

  if (!turn) return null;

  const emit = (type: string, amount?: number) => {
    socket?.emit(GAME_EVENTS.ACTION, { type, amount });
  };

  const minRaise = turn.minRaise;
  const effectiveRaise = Math.max(raiseAmount, minRaise);

  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'center',
      padding: '12px', background: '#1e293b', borderRadius: '12px',
      flexWrap: 'wrap', justifyContent: 'center',
    }}>
      <button onClick={() => emit('FOLD')} style={btnStyle('#ef4444')}>
        Fold
      </button>

      {turn.canCheck ? (
        <button onClick={() => emit('CHECK')} style={btnStyle('#3b82f6')}>
          Check
        </button>
      ) : (
        <button onClick={() => emit('CALL')} style={btnStyle('#3b82f6')}>
          Call {turn.callAmount}
        </button>
      )}

      {turn.canRaise && (
        <>
          <input
            type="range"
            min={minRaise}
            max={turn.callAmount + 5000}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            style={{ width: '120px' }}
          />
          <button onClick={() => emit('RAISE', effectiveRaise)} style={btnStyle('#16a34a')}>
            Raise {effectiveRaise}
          </button>
        </>
      )}

      <button onClick={() => emit('ALL_IN')} style={btnStyle('#dc2626')}>
        All In
      </button>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '8px 16px', backgroundColor: bg, color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '14px',
  fontWeight: 600, cursor: 'pointer',
});

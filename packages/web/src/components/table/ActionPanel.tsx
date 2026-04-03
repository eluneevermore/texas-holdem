import { useState } from 'react';
import { GAME_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';
import { useGameStore } from '../../stores/gameStore';

export default function ActionPanel() {
  const socket = useSocketStore((s) => s.socket);
  const gs = useGameStore((s) => s.publicState);
  const [raiseAmount, setRaiseAmount] = useState(0);

  if (!gs || !gs.activePlayerActions) return null;

  const actions = gs.activePlayerActions;

  const emit = (type: string, amount?: number) => {
    socket?.emit(GAME_EVENTS.ACTION, { type, amount });
  };

  const effectiveRaise = Math.max(raiseAmount, actions.minRaise);

  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'center',
      padding: '12px', background: '#1e293b', borderRadius: '12px',
      flexWrap: 'wrap', justifyContent: 'center',
    }}>
      <button onClick={() => emit('FOLD')} style={btnStyle('#ef4444')}>
        Fold
      </button>

      {actions.canCheck ? (
        <button onClick={() => emit('CHECK')} style={btnStyle('#3b82f6')}>
          Check
        </button>
      ) : actions.canCall ? (
        <button onClick={() => emit('CALL')} style={btnStyle('#3b82f6')}>
          Call {actions.callAmount}
        </button>
      ) : null}

      {actions.canRaise && (
        <>
          <input
            type="range"
            min={actions.minRaise}
            max={actions.maxRaise}
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

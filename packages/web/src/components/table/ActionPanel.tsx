import { useState, useEffect } from 'react';
import { GAME_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';
import { useGameStore } from '../../stores/gameStore';

interface PotPreset {
  label: string;
  amount: number;
}

export default function ActionPanel() {
  const socket = useSocketStore((s) => s.socket);
  const gs = useGameStore((s) => s.publicState);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const actions = gs?.activePlayerActions ?? null;

  useEffect(() => {
    if (actions?.minRaise) setRaiseAmount(actions.minRaise);
  }, [actions?.minRaise]);

  if (!gs || !actions) return null;

  const emit = (type: string, amount?: number) => {
    socket?.emit(GAME_EVENTS.ACTION, { type, amount });
  };

  const effectiveRaise = Math.max(raiseAmount, actions.minRaise);

  const potPresets: PotPreset[] = [];
  if (actions.canRaise) {
    const callAmt = actions.canCall ? actions.callAmount : 0;
    const potAfterCall = gs.totalPot + callAmt;

    for (const [frac, label] of [[0.25, '1/4'], [0.5, '1/2'], [1, 'Pot']] as const) {
      const total = Math.round(gs.currentBet + frac * potAfterCall);
      if (total >= actions.minRaise && total <= actions.maxRaise) {
        potPresets.push({ label: `${label} Pot`, amount: total });
      }
    }
  }

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
          {potPresets.map((p) => (
            <button
              key={p.label}
              onClick={() => emit('RAISE', p.amount)}
              style={btnStyle('#7c3aed')}
            >
              {p.label}
            </button>
          ))}

          <input
            type="range"
            min={actions.minRaise}
            max={actions.maxRaise}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            style={{ width: '120px', accentColor: '#16a34a' }}
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

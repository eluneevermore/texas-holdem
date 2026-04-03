import { useState } from 'react';
import type { RoomConfig } from '@poker/shared';
import { ROOM_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';

interface Props {
  config: RoomConfig;
}

export default function ConfigPanel({ config }: Props) {
  const socket = useSocketStore((s) => s.socket);
  const [localConfig, setLocalConfig] = useState(config);

  const update = (key: keyof RoomConfig, value: number | boolean) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    socket?.emit(ROOM_EVENTS.CONFIG_UPDATE, { [key]: value });
  };

  const inputStyle: React.CSSProperties = {
    width: '80px', padding: '6px', borderRadius: '6px',
    border: '1px solid #374151', background: '#1f2937', color: '#f3f4f6',
    textAlign: 'right',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      padding: '16px', background: '#111827', borderRadius: '12px',
    }}>
      <h3 style={{ margin: 0, color: '#e5e7eb' }}>Room Settings</h3>

      <label style={{ color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Small Blind
        <input type="number" value={localConfig.smallBlind} style={inputStyle}
          onChange={(e) => update('smallBlind', Number(e.target.value))} />
      </label>

      <label style={{ color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Big Blind
        <input type="number" value={localConfig.bigBlind} style={inputStyle}
          onChange={(e) => update('bigBlind', Number(e.target.value))} />
      </label>

      <label style={{ color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Starting Stack
        <input type="number" value={localConfig.initialStack} style={inputStyle}
          onChange={(e) => update('initialStack', Number(e.target.value))} />
      </label>

      <label style={{ color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Buy-In Amount
        <input type="number" value={localConfig.buyInAmount} style={inputStyle}
          onChange={(e) => update('buyInAmount', Number(e.target.value))} />
      </label>

      <label style={{ color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Allow Buy-In
        <input type="checkbox" checked={localConfig.buyInAllowed}
          onChange={(e) => update('buyInAllowed', e.target.checked)} />
      </label>
    </div>
  );
}

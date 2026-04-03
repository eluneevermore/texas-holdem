import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { displayName, isGuest } = useAuthStore();
  const navigate = useNavigate();

  if (isGuest) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', color: '#94a3b8',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'system-ui, sans-serif',
      }}>
        <p>Sign in to view your profile and stats.</p>
        <button onClick={() => navigate('/')} style={{
          marginTop: '16px', padding: '8px 20px', background: '#3b82f6',
          color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
        }}>
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px', fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ marginBottom: '24px' }}>Profile</h1>
      <div style={{
        background: '#1e293b', borderRadius: '12px', padding: '24px',
        minWidth: '300px',
      }}>
        <p style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 600 }}>
          {displayName}
        </p>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Stats are tracked after playing hands while signed in.
        </p>
      </div>
      <button onClick={() => navigate('/')} style={{
        marginTop: '24px', padding: '8px 20px', background: '#374151',
        color: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer',
      }}>
        Back to Lobby
      </button>
    </div>
  );
}

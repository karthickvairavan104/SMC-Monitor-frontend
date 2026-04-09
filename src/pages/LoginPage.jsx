import { GoogleLogin } from '@react-oauth/google';
import { Auth } from '../api/endpoints';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import { T } from '../utils/format';

const ALLOW_DEV_LOGIN = import.meta.env.VITE_ALLOW_DEV_LOGIN === '1';

export default function LoginPage() {
  const setAuth = useStore(s => s.setAuth);

  async function handleSuccess(credentialResponse) {
    try {
      const r = await Auth.google(credentialResponse.credential);
      setAuth(r.data.user, r.data.token);
      toast.success(`Welcome, ${r.data.user.name}`);
    } catch {
      toast.error('Login failed — please try again');
    }
  }

  function handleDevLogin() {
    // Dev-only login stub: sets a mock user and token so you can work without Google.
    const mockUser = { id: 'dev', name: 'Developer', picture: '' };
    const mockToken = 'dev-token';
    setAuth(mockUser, mockToken);
    toast.success('Signed in as Developer (dev-only)');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: T.bg, gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.05em' }}>
          <span style={{ color: T.accent }}>SMC</span>
          <span style={{ color: T.muted }}> LIVE MONITOR </span>
          <span style={{ color: T.blue }}>v15</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
          Server-side 24/7 scanning · Auto-close · Real-time WebSocket push
        </div>
      </div>

      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: '32px 40px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Sign in to access your dashboard</div>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => toast.error('Google sign-in failed')}
          theme="filled_black"
          shape="pill"
          size="large"
        />
        {ALLOW_DEV_LOGIN && (
          <div style={{ marginTop: 12 }}>
            <button onClick={handleDevLogin} style={{ padding: '8px 12px', fontFamily: 'monospace', cursor: 'pointer', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text }}>
              Dev sign in
            </button>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>Dev login is enabled (VITE_ALLOW_DEV_LOGIN=1)</div>
          </div>
        )}
      </div>
    </div>
  );
}

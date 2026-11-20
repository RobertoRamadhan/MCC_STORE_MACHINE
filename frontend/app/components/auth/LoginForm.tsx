'use client';

import { useState } from 'react';

type LoginFormProps = {
  onLogin: (nama: string, role: string, perms: string[], mesin: string) => void;
};

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Username dan password wajib diisi!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Username atau password salah!');
      }

      const token = data?.token || data?.accessToken || data?.data?.token || data?.access_token;
      if (token) {
        localStorage.setItem('mcc_token', token);
      }

      const user = data?.user || data?.data?.user || data?.profile || data?.data || {};
      onLogin(
        user.nama || user.name || user.username || username,
        user.role || 'admin',
        user.permissions || ['all'],
        user.mesin || ''
      );
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '48px',
    padding: '0 14px',
    boxSizing: 'border-box',
    border: '1px solid var(--mcc-border)',
    borderRadius: '6px',
    background: 'var(--mcc-surface)',
    color: 'var(--mcc-text)',
    fontFamily: 'inherit',
    fontSize: '16px',
    outline: 'none',
  };

  return (
    <div className="mcc-login" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', background: 'var(--mcc-surface)', color: 'var(--mcc-text)', fontFamily: 'var(--mcc-font)' }}>
      <aside className="mcc-login-brand" style={{ width: '40%', maxWidth: '560px', minWidth: '360px', background: 'var(--mcc-navy)', display: 'flex', flexDirection: 'column', padding: '56px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px' }}>PHILIPS</div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '48px', height: '4px', background: 'var(--mcc-blue)' }} />
          <h1 style={{ margin: 0, fontSize: '40px', lineHeight: 1.15, fontWeight: 700, color: '#ffffff' }}>Sistem Spare Part MCC</h1>
          <p style={{ margin: 0, fontSize: '18px', lineHeight: 1.5, color: '#c3cfdf', maxWidth: '400px' }}>Pengelolaan stok, permintaan teknisi, dan dokumentasi pengambilan part di Store MCC.</p>
        </div>
        <div style={{ marginTop: '64px', fontSize: '14px', color: '#9fb0c8' }}>PT Philips Industries Batam</div>
      </aside>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', boxSizing: 'border-box' }}>
        <div className="mcc-fade-in" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Masuk sebagai admin</h2>
            <p style={{ margin: 0, fontSize: '16px', color: 'var(--mcc-text-muted)' }}>Gunakan akun Store MCC Anda.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="login-username" style={{ fontSize: '15px', fontWeight: 600 }}>Username</label>
            <input id="login-username" autoComplete="username" autoFocus style={inputStyle} placeholder="Masukkan username" value={username} onChange={(event) => { setUsername(event.target.value); setError(''); }} onKeyDown={(event) => event.key === 'Enter' && handleLogin()} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="login-password" style={{ fontSize: '15px', fontWeight: 600 }}>Password</label>
            <div className="mcc-login-pass" style={{ display: 'flex', alignItems: 'center', height: '48px', border: '1px solid var(--mcc-border)', borderRadius: '6px', padding: '0 6px 0 14px', boxSizing: 'border-box', background: 'var(--mcc-surface)' }}>
              <input id="login-password" autoComplete="current-password" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--mcc-text)', fontFamily: 'inherit', fontSize: '16px' }} type={showPass ? 'text' : 'password'} placeholder="Masukkan password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} onKeyDown={(event) => event.key === 'Enter' && handleLogin()} />
              <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '4px', background: 'transparent', color: 'var(--mcc-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {showPass
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="mcc-fade-in" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '6px', background: 'var(--mcc-danger-soft)', color: 'var(--mcc-danger)', fontSize: '15px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
              <span>{error}</span>
            </div>
          )}

          <button type="button" onClick={handleLogin} disabled={loading} className="mcc-login-btn" style={{ height: '48px', border: 'none', borderRadius: '6px', background: 'var(--mcc-blue)', color: '#ffffff', fontFamily: 'inherit', fontSize: '16px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1 }}>
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </div>
      </main>

      <style>{`
        .mcc-login input::placeholder{color:#8a97a8;}
        .mcc-login input#login-username:focus,.mcc-login-pass:focus-within{border-color:var(--mcc-blue)!important;box-shadow:0 0 0 3px var(--mcc-blue-soft);}
        .mcc-login input:focus-visible{outline:none;}
        .mcc-login-btn{transition:background var(--mcc-dur-fast) var(--mcc-ease);}
        .mcc-login-btn:hover:not(:disabled){background:var(--mcc-blue-hover)!important;}
        @media (max-width: 900px){.mcc-login-brand{display:none!important;}}
      `}</style>
    </div>
  );
}

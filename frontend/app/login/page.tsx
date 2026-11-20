'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import LoginForm from '../components/auth/LoginForm';

const subscribeToSession = () => () => {};
const getSessionSnapshot = () => Boolean(sessionStorage.getItem('mcc_login'));
const getServerSessionSnapshot = () => false;

type LoginUser = {
  nama: string;
  role: string;
  permissions: string[];
  mesin: string;
};

export default function LoginPage() {
  const [welcome, setWelcome] = useState('');
  const hasSession = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getServerSessionSnapshot
  );

  useEffect(() => {
    if (hasSession && !welcome) {
      window.location.replace('/admin');
    }
  }, [hasSession, welcome]);

  const handleLogin = (nama: string, role: string, permissions: string[], mesin: string) => {
    const time = new Date().toLocaleString('id-ID');
    const user: LoginUser = { nama, role, permissions, mesin };
    sessionStorage.setItem('mcc_login', JSON.stringify({ ...user, time }));
    setWelcome(nama);
    window.setTimeout(() => window.location.replace('/admin'), 2200);
  };

  if (hasSession && !welcome) return null;

  if (welcome) {
    return (
      <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--mcc-navy)', color: '#ffffff', fontFamily: 'var(--mcc-font)' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>PHILIPS</div>
        <div className="mcc-fade-in" style={{ fontSize: '26px', fontWeight: 600, animationDelay: '150ms' }}>Selamat datang, {welcome}</div>
        <div style={{ fontSize: '15px', color: '#9fb0c8' }}>Memuat dashboard...</div>
        <div style={{ width: '200px', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
          <div style={{ height: '100%', background: 'var(--mcc-blue)', animation: 'loadingBar 1.8s var(--mcc-ease) forwards' }} />
        </div>
        <style>{'@keyframes loadingBar{from{width:0%;}to{width:100%;}}'}</style>
      </div>
    );
  }

  return <LoginForm onLogin={handleLogin} />;
}

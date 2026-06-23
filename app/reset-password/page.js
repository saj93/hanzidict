'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => { document.title = 'Reset Password — HanziDict'; }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [debug, setDebug] = useState('starting…');

  useEffect(() => {
    const supabase = createClient();

    const code = new URLSearchParams(window.location.search).get('code');
    setDebug(`code found: ${!!code}`);
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        setDebug(`exchange done — error: ${JSON.stringify(error?.message)} | session: ${!!data?.session} | user: ${!!data?.user}`);
        if (error) {
          setError(`Exchange error: ${error.message}`);
        } else if (data?.session) {
          setReady(true);
        } else {
          setError(`No session returned. data: ${JSON.stringify(data)}`);
        }
      });
    } else {
      setDebug('no code in URL — waiting for PASSWORD_RECOVERY event');
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        setDebug(`auth event: ${event}`);
        if (event === 'PASSWORD_RECOVERY') setReady(true);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push('/login'), 2500);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
      </nav>

      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-title">New password</h1>

          {done ? (
            <p className="auth-sub" style={{ marginBottom: 0 }}>
              Password updated. Redirecting to log in…
            </p>
          ) : !ready ? (
            <>
              <p className="auth-sub" style={{ marginBottom: 8 }}>
                Verifying your reset link…
              </p>
              <p style={{ fontSize: 11, color: 'var(--fg3)', wordBreak: 'break-all' }}>{debug}</p>
            </>
          ) : (
            <>
              <p className="auth-sub">Choose a new password for your account.</p>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">New password</label>
                  <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Confirm password</label>
                  <input
                    className="auth-input"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {error && <div className="auth-error">{error}</div>}
                <button className="auth-submit" type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

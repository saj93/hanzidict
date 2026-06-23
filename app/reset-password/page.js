'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => { document.title = 'Reset Password — HanziDict'; }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const accessTokenRef = useRef(null);

  useEffect(() => {
    // Dynamically import to avoid SSR issues with localStorage
    import('@/lib/supabase-auth').then(({ createAuthClient }) => {
      const supabase = createAuthClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.access_token) {
          accessTokenRef.current = session.access_token;
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!accessTokenRef.current) { setError('Session expired — please request a new reset link.'); return; }
    setError('');
    setLoading(true);

    // Call Supabase REST API directly with the access token from the auth event.
    // This bypasses client session management, which loses the recovery session
    // between the auth event and the updateUser call.
    const resp = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessTokenRef.current}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ password }),
      }
    );

    setLoading(false);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.msg || body.message || 'Failed to update password.');
      return;
    }
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
            <p className="auth-sub" style={{ marginBottom: 0 }}>Verifying your reset link…</p>
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

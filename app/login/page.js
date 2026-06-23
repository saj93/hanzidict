'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { createAuthClient } from '@/lib/supabase-auth';
import Nav from '@/app/components/Nav';

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { document.title = 'Log In — HanziDict'; }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const resetInputRef = useRef(null);
  const [callbackError, setCallbackError] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('error');
    if (p) setCallbackError(p);
  }, []);

  useEffect(() => {
    if (resetOpen) {
      setResetEmail(email);
      setResetSent(false);
      setResetError('');
      setTimeout(() => resetInputRef.current?.focus(), 50);
    }
  }, [resetOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/hsk');
    router.refresh();
  }

  async function handleReset(e) {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    const supabase = createAuthClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) { setResetError(error.message); return; }
    setResetSent(true);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav hideScript />

      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Log in to track your progress</p>
          {callbackError && (
            <div className="auth-error" style={{ marginBottom: 12 }}>
              Reset link error: {callbackError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <span className="auth-label">Password</span>
                <button
                  type="button"
                  className="auth-link auth-forgot"
                  onClick={() => setResetOpen(true)}
                >
                  Forgot password?
                </button>
              </div>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="auth-switch">
            No account?{' '}
            <button className="auth-link" onClick={() => router.push('/signup')}>
              Sign up
            </button>
          </p>
        </div>
      </div>

      {resetOpen && (
        <>
          <div className="auth-modal-backdrop" onClick={() => setResetOpen(false)} />
          <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Reset password">
            <h2 className="auth-modal-title">Reset your password</h2>
            {resetSent ? (
              <>
                <p className="auth-modal-sent">Check your email for a reset link.</p>
                <button className="auth-submit" style={{ marginTop: 16 }} onClick={() => setResetOpen(false)}>
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={handleReset} className="auth-form" style={{ gap: 14 }}>
                <div className="auth-field">
                  <label className="auth-label">Email address</label>
                  <input
                    ref={resetInputRef}
                    className="auth-input"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                {resetError && <div className="auth-error">{resetError}</div>}
                <button className="auth-submit" type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  className="auth-link"
                  style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 4 }}
                  onClick={() => setResetOpen(false)}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </main>
  );
}

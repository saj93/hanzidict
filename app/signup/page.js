'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
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
          {done ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-sub">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
              <button className="auth-submit" style={{ marginTop: 24 }} onClick={() => router.push('/login')}>
                Go to login
              </button>
            </>
          ) : (
            <>
              <h1 className="auth-title">Create account</h1>
              <p className="auth-sub">Start tracking your flashcard progress</p>

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
                  <label className="auth-label">Password</label>
                  <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="min. 8 characters"
                    required
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
                  {loading ? 'Creating account…' : 'Sign up'}
                </button>
              </form>

              <p className="auth-switch">
                Already have an account?{' '}
                <button className="auth-link" onClick={() => router.push('/login')}>
                  Log in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

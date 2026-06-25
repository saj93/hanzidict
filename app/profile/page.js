'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { createClient } from '@/lib/supabase';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

function ProgressBar({ learned, total }) {
  const pct = total > 0 ? Math.min(100, (learned / total) * 100) : 0;
  return (
    <div className="prof-bar-track">
      <div className="prof-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();
  const { isPremium, plan, premiumUntil, status: subStatus, loading: subLoading } = useSubscription();
  const [username, setUsername] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => { document.title = 'Profile — HanziDict'; }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/profile');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setUsername(user.user_metadata?.username ?? '');
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      setUpgraded(true);
      window.history.replaceState({}, '', '/profile');
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', { value: 4.99, currency: 'USD' });
      }
    }
  }, []);

  useEffect(() => {
    if (!user || !session) return;
    fetch('/api/profile/stats', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.stats) setStats(d.stats); })
      .catch(() => {});
  }, [user, session]);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError('');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error ?? 'Could not open portal. Please try again.');
      }
    } catch (err) {
      setPortalError('Network error. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading || !user) return null;

  const email = user.email ?? '';
  const initial = (username?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const hasProgress = stats && (stats.totalLearned > 0 || stats.streak > 0 || stats.totalSessions > 0);

  async function save(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setError('Username must be at least 2 characters.'); return;
    }
    if (trimmed.length > 30) {
      setError('Username must be 30 characters or less.'); return;
    }
    if (trimmed && !/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) {
      setError('Only letters, numbers, spaces, hyphens and underscores.'); return;
    }
    setError('');
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({
      data: { username: trimmed || null },
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const renewalLabel = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <main>
      <Nav />
      <div className="prof-wrap">

        {/* ── Upgrade success banner ── */}
        {upgraded && (
          <div className="prof-upgraded-banner">
            🎉 Welcome to HanziDict Premium! Your subscription is now active.
          </div>
        )}

        {/* ── Header ── */}
        <div className="up-hero">
          <div className="up-avatar">{initial}</div>
          <div className="up-hero-info">
            <div className="up-hero-name">{username || email}</div>
            <div className="up-hero-since">Member since {joinedDate}</div>
          </div>
        </div>

        {/* ── Stats ── */}
        {stats === null ? (
          <div className="prof-loading">Loading stats…</div>
        ) : !hasProgress ? (
          <div className="prof-empty">
            <div className="prof-empty-icon">🎯</div>
            <div className="prof-empty-title">No flashcard progress yet</div>
            <div className="prof-empty-sub">Complete your first session to start tracking your streak and progress.</div>
            <button className="up-save-btn" onClick={() => router.push('/hsk')}>
              Start Flashcards →
            </button>
          </div>
        ) : (
          <>
            {/* Streak + summary */}
            <div className="prof-top-row">
              <div className="prof-streak-card">
                <div className="prof-streak-flame">⚡</div>
                <div className="prof-streak-num">{stats.streak}</div>
                <div className="prof-streak-label">day streak</div>
              </div>
              <div className="prof-summary-cards">
                <div className="prof-summary-card">
                  <div className="prof-summary-num">{stats.totalLearned.toLocaleString()}</div>
                  <div className="prof-summary-label">words learned</div>
                </div>
                <div className="prof-summary-card">
                  <div className="prof-summary-num">{stats.totalSessions.toLocaleString()}</div>
                  <div className="prof-summary-label">sessions completed</div>
                </div>
              </div>
            </div>

            {/* HSK level breakdown */}
            <div className="up-card prof-levels-card">
              <div className="prof-levels-title">Progress by level</div>
              {stats.levels.map(l => (
                <div key={l.level} className="prof-level-row">
                  <div className="prof-level-meta">
                    <span className="prof-level-name">{l.label}</span>
                    <span className="prof-level-count">{l.learned.toLocaleString()} / {l.total.toLocaleString()}</span>
                  </div>
                  <ProgressBar learned={l.learned} total={l.total} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Subscription ── */}
        {!subLoading && (
          <div className="up-card prof-subscription-card">
            <div className="prof-settings-title">Subscription</div>
            {isPremium ? (
              <div className="prof-sub-content">
                <div className="prof-sub-row">
                  <span className="prof-sub-badge prof-sub-badge--active">Premium</span>
                  <span className="prof-sub-plan">{plan === 'yearly' ? 'Annual plan' : 'Monthly plan'}</span>
                </div>
                {renewalLabel && (
                  <div className="prof-sub-renews">Renews {renewalLabel}</div>
                )}
                <button
                  className="prof-portal-btn"
                  onClick={openPortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Loading…' : 'Manage subscription →'}
                </button>
                {portalError && <div className="prof-portal-error">{portalError}</div>}
              </div>
            ) : subStatus === 'cancelled' ? (
              <div className="prof-sub-content">
                <div className="prof-sub-row">
                  <span className="prof-sub-badge prof-sub-badge--cancelled">Cancelled</span>
                </div>
                <div className="prof-sub-renews">Your access has ended.</div>
                <button className="up-save-btn" onClick={() => router.push('/pricing')}>
                  Resubscribe →
                </button>
              </div>
            ) : (
              <div className="prof-sub-content">
                <div className="prof-sub-free">You&apos;re on the free plan.</div>
                <button className="up-save-btn" onClick={() => router.push('/pricing')}>
                  Upgrade to Premium →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Account settings ── */}
        <div className="up-card prof-settings-card">
          <div className="prof-settings-title">Account</div>
          <form onSubmit={save}>
            <div className="up-field">
              <label className="up-label">Username</label>
              <input
                className="up-input"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setSaved(false); }}
                placeholder="e.g. learner42"
                maxLength={30}
                autoComplete="username"
              />
              <p className="up-hint">Shown in your avatar and across the app. Optional.</p>
            </div>
            <div className="up-field">
              <label className="up-label">Email</label>
              <input className="up-input" type="email" value={email} disabled />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="up-actions">
              <button className="up-save-btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

      </div>
      <Footer />
    </main>
  );
}

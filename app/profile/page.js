'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { createClient } from '@/lib/supabase';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Profile — HanziDict'; }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/profile');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setUsername(user.user_metadata?.username ?? '');
  }, [user]);

  if (loading || !user) return null;

  const email = user.email ?? '';
  const initial = (username?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

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

  return (
    <main>
      <Nav />
      <div className="up-wrap">
        {/* Avatar + name */}
        <div className="up-hero">
          <div className="up-avatar">{initial}</div>
          <div className="up-hero-info">
            <div className="up-hero-name">{username || email}</div>
            <div className="up-hero-since">Member since {joinedDate}</div>
          </div>
        </div>

        <div className="up-card">
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
              <input
                className="up-input"
                type="email"
                value={email}
                disabled
              />
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase';

export default function UserMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (loading) return <div style={{ width: 32 }} />;

  if (!user) {
    return (
      <button className="nav-link" onClick={() => router.push('/login')}
        style={{ fontWeight: 500, color: 'var(--accent)' }}>
        Login
      </button>
    );
  }

  const initial = (user.email?.[0] ?? '?').toUpperCase();
  const email = user.email ?? '';
  const displayEmail = email.length > 18 ? email.slice(0, 15) + '…' : email;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="user-avatar-btn"
        onClick={() => setOpen(o => !o)}
        title={email}
      >
        {initial}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
          <div className="user-dropdown">
            <div className="user-dropdown-email">{displayEmail}</div>
            <button className="user-dropdown-item" onClick={() => { setOpen(false); router.push('/flashcards'); }}>
              Flashcards
            </button>
            <div className="user-dropdown-divider" />
            <button className="user-dropdown-item danger" onClick={logout}>
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

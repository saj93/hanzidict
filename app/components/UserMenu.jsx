'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase';

export default function UserMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const router = useRouter();

  // Pick up username from user_metadata whenever user changes
  useEffect(() => {
    setUsername(user?.user_metadata?.username ?? '');
  }, [user]);

  if (loading) return <div style={{ width: 32 }} />;

  if (!user) {
    return (
      <button className="nav-login-btn" onClick={() => router.push('/login')}>
        Login
      </button>
    );
  }

  const email = user.email ?? '';
  const displayEmail = email.length > 18 ? email.slice(0, 15) + '…' : email;
  const initial = (username?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const displayName = username || displayEmail;

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
            <div className="user-dropdown-header">
              <div className="user-dropdown-avatar">{initial}</div>
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">{username || 'Set a username'}</div>
                <div className="user-dropdown-email">{displayEmail}</div>
              </div>
            </div>
            <div className="user-dropdown-divider" />
            <button className="user-dropdown-item" onClick={() => { setOpen(false); router.push('/profile'); }}>
              Profile
            </button>
<button className="user-dropdown-item" onClick={() => { setOpen(false); router.push('/lists'); }}>
              My Lists
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

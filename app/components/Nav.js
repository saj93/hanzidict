'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import UserMenu from './UserMenu';
import NavSearch from './NavSearch';
import { useAuth } from './AuthProvider';

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch (e) {}
  }

  function go(path) {
    setMenuOpen(false);
    router.push(path);
  }

  const isActive = (path) => pathname === path || (path === '/' && pathname === '/');

  const links = [
    { label: 'Dictionary', path: '/' },
    { label: 'Flashcards', path: '/flashcards' },
    { label: 'Verbs', path: '/verbs' },
    { label: 'Learn', path: '/learn' },
    { label: 'Blog', path: '/blog' },
    { label: 'About', path: '/about' },
  ];

  return (
    <>
      <nav className="nav">
        <button className="nav-logo" onClick={() => go('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          {links.map(({ label, path }) => (
            <button
              key={path}
              className={`nav-link${isActive(path) ? ' active' : ''}`}
              onClick={() => go(path)}
            >
              {label}
            </button>
          ))}
          <button className="script-btn" onClick={toggleScript} title="Toggle script">
            {script === 'traditional' ? '繁' : '简'}
          </button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <UserMenu />
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            <span className={`ham-line${menuOpen ? ' open' : ''}`} />
            <span className={`ham-line${menuOpen ? ' open' : ''}`} />
            <span className={`ham-line${menuOpen ? ' open' : ''}`} />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          {links.map(({ label, path }) => (
            <button
              key={path}
              className={`mobile-menu-link${isActive(path) ? ' active' : ''}`}
              onClick={() => go(path)}
            >
              {label}
            </button>
          ))}
          {!user && (
            <button className="mobile-menu-link" onClick={() => go('/login')}>Log in</button>
          )}
          <div className="mobile-menu-actions">
            <button className="script-btn" onClick={toggleScript}>{script === 'traditional' ? '繁' : '简'}</button>
            <button className="theme-btn" onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
          </div>
        </div>
      )}
    </>
  );
}

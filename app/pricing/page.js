'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import UserMenu from '../components/UserMenu';
import NavSearch from '../components/NavSearch';
import Footer from '../components/Footer';

export default function PricingPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { isPremium, plan: currentPlan } = useSubscription();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(null); // 'monthly' | 'annual' | null

  useEffect(() => { document.title = 'Pricing — HanziDict'; }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  async function subscribe(plan) {
    if (!user) {
      router.push('/login?next=/pricing');
      return;
    }
    setLoading(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Something went wrong. Please try again.');
        setLoading(null);
      }
    } catch {
      alert('Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  const nav = (
    <>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/flashcards'); }}>Flashcards</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}
    </>
  );

  return (
    <main>
      {nav}

      <div className="pricing-page">
        <div className="pricing-header">
          <h1 className="pricing-title">Unlock all HSK levels</h1>
          <p className="pricing-sub">
            Free forever for HSK 1–4. Upgrade to access HSK 5–9 flashcards with full spaced repetition.
          </p>
        </div>

        {isPremium && (
          <div className="pricing-active-banner">
            ✓ You're on the <strong>{currentPlan === 'annual' ? 'Annual' : 'Monthly'}</strong> plan — all decks unlocked.
          </div>
        )}

        <div className="pricing-cards">

          {/* Free plan */}
          <div className="pricing-card">
            <div className="pricing-plan-name">Free</div>
            <div className="pricing-price-row">
              <span className="pricing-amount">$0</span>
              <span className="pricing-period">forever</span>
            </div>
            <ul className="pricing-features">
              <li className="pricing-feature">✓ HSK 1–4 flashcards</li>
              <li className="pricing-feature">✓ Spaced repetition (SRS)</li>
              <li className="pricing-feature">✓ Progress tracking</li>
              <li className="pricing-feature">✓ Full dictionary (124k entries)</li>
              <li className="pricing-feature pricing-feature-off">✗ HSK 5–9 flashcards</li>
            </ul>
            <button className="pricing-btn pricing-btn-secondary" onClick={() => router.push('/flashcards')}>
              {user ? 'Go to Flashcards' : 'Get started free'}
            </button>
          </div>

          {/* Monthly plan */}
          <div className="pricing-card pricing-card-featured">
            <div className="pricing-badge">Most flexible</div>
            <div className="pricing-plan-name">Monthly</div>
            <div className="pricing-price-row">
              <span className="pricing-amount">$4.99</span>
              <span className="pricing-period">/ month</span>
            </div>
            <ul className="pricing-features">
              <li className="pricing-feature">✓ Everything in Free</li>
              <li className="pricing-feature">✓ HSK 5–9 flashcards</li>
              <li className="pricing-feature">✓ 12,000+ advanced words</li>
              <li className="pricing-feature">✓ Cancel any time</li>
            </ul>
            <button
              className="pricing-btn pricing-btn-primary"
              onClick={() => subscribe('monthly')}
              disabled={!!loading || (isPremium && currentPlan === 'monthly')}
            >
              {isPremium && currentPlan === 'monthly'
                ? '✓ Current plan'
                : loading === 'monthly' ? 'Redirecting…' : 'Subscribe monthly'}
            </button>
          </div>

          {/* Annual plan */}
          <div className="pricing-card pricing-card-featured">
            <div className="pricing-badge pricing-badge-green">Best value — save 33%</div>
            <div className="pricing-plan-name">Annual</div>
            <div className="pricing-price-row">
              <span className="pricing-amount">$39.99</span>
              <span className="pricing-period">/ year</span>
            </div>
            <div className="pricing-monthly-equiv">$3.33 / month</div>
            <ul className="pricing-features">
              <li className="pricing-feature">✓ Everything in Free</li>
              <li className="pricing-feature">✓ HSK 5–9 flashcards</li>
              <li className="pricing-feature">✓ 12,000+ advanced words</li>
              <li className="pricing-feature">✓ 2 months free vs monthly</li>
            </ul>
            <button
              className="pricing-btn pricing-btn-primary"
              onClick={() => subscribe('annual')}
              disabled={!!loading || (isPremium && currentPlan === 'annual')}
            >
              {isPremium && currentPlan === 'annual'
                ? '✓ Current plan'
                : loading === 'annual' ? 'Redirecting…' : 'Subscribe annually'}
            </button>
          </div>

        </div>

        <p className="pricing-footnote">
          Payments processed securely by Stripe. Cancel any time from your account settings.
        </p>
      </div>

      <Footer />
    </main>
  );
}

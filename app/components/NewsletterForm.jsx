'use client';

import { useState } from 'react';

export default function NewsletterForm({ compact = false }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (compact) {
    return (
      <div className="nl-compact">
        {status === 'success' ? (
          <span className="nl-compact-success">You're in! Check your inbox.</span>
        ) : (
          <form className="nl-compact-form" onSubmit={submit}>
            <span className="nl-compact-label">Receive your 5-min Chinese lesson everyday for free</span>
            <input
              className="nl-compact-input"
              type="email"
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
              required
            />
            <button className="nl-compact-btn" type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? '…' : 'Subscribe'}
            </button>
            {status === 'error' && (
              <span className="nl-compact-error">Failed. Try again.</span>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <section className="nl-section">
      <div className="nl-inner">
        <h2 className="nl-heading">Learn something new every week</h2>
        <p className="nl-sub">One character, one grammar point — delivered weekly.</p>
        {status === 'success' ? (
          <p className="nl-success">You're in! Check your inbox.</p>
        ) : (
          <form className="nl-form" onSubmit={submit}>
            <input
              className="nl-input"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
              required
            />
            <button className="nl-btn" type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? '…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="nl-error">Something went wrong. Try again.</p>
        )}
      </div>
    </section>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function AdminSuggestionsPage() {
  const { isAdmin, session, loading: authLoading } = useAuth() ?? {};
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // id being acted on

  const fetchSuggestions = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/suggestions?status=${status}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [session, status]);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin && session) fetchSuggestions();
  }, [isAdmin, session, fetchSuggestions]);

  async function act(id, action) {
    setActing(id);
    try {
      await fetch(`/api/admin/suggestions/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });
      setSuggestions(s => s.filter(x => x.id !== id));
    } catch (e) {
      console.error(e);
    }
    setActing(null);
  }

  if (authLoading || !isAdmin) return null;

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', marginBottom: 24 }}>
        Correction Suggestions
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid var(--border)',
              background: status === s ? 'var(--accent)' : 'transparent',
              color: status === s ? 'white' : 'var(--fg2)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg3)', fontSize: 15 }}>Loading…</div>
      ) : suggestions.length === 0 ? (
        <div style={{ color: 'var(--fg3)', fontSize: 15 }}>No {status} suggestions.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {suggestions.map(s => (
            <div key={s.id} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => router.push(`/word/${encodeURIComponent(s.entry?.simplified || '')}`)}
                  style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {s.entry?.simplified}
                </button>
                <span style={{ fontSize: 13, color: 'var(--fg3)' }}>{s.entry?.pinyin}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 7px',
                }}>
                  {s.field}
                </span>
                <span style={{ fontSize: 12, color: 'var(--fg3)', marginLeft: 'auto' }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current</div>
                  <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>{s.current_value || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Suggested</div>
                  <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.5 }}>{s.suggested_value}</div>
                </div>
              </div>

              {s.reason && (
                <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 14, fontStyle: 'italic' }}>
                  "{s.reason}"
                </div>
              )}

              {status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => act(s.id, 'approve')}
                    disabled={acting === s.id}
                    style={{
                      padding: '7px 18px', borderRadius: 8, border: '1px solid var(--accent)',
                      background: 'var(--accent-dim)', color: 'var(--accent-text)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    {acting === s.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => act(s.id, 'reject')}
                    disabled={acting === s.id}
                    style={{
                      padding: '7px 18px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--fg2)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    }}
                  >
                    {acting === s.id ? '…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

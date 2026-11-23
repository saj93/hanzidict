'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from './AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { loadingReport } from '../../lib/loadingDiagnostics';

const diagnosticEnabled = () => new URLSearchParams(window.location.search).get('diagnostic') === '1';
const serverDisabled = () => false;
const subscribeLocation = notify => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};

export default function WordLoadDiagnostics({ wordLoad }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: subscriptionPending } = useSubscription();
  const enabled = useSyncExternalStore(subscribeLocation, diagnosticEnabled, serverDisabled);
  const [report, setReport] = useState('');
  const [copied, setCopied] = useState(false);
  const longTasks = useRef(null);

  useEffect(() => {
    if (!enabled || !window.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) return;
    longTasks.current = [];
    const observer = new PerformanceObserver(list => longTasks.current.push(...list.getEntries()));
    observer.observe({ type: 'longtask', buffered: true });
    return () => observer.disconnect();
  }, [enabled]);

  async function capture() {
    const text = JSON.stringify(loadingReport({
      origin: window.location.origin,
      account: authLoading ? 'pending' : user ? 'signed_in' : 'signed_out',
      subscriptionPending, wordLoad,
      resources: performance.getEntriesByType('resource'),
      navigation: performance.getEntriesByType('navigation')[0],
      now: performance.now(), longTasks: longTasks.current,
    }), null, 2);
    setReport(text); setCopied(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  }

  if (!enabled) return null;
  return <aside data-loading-diagnostics style={{ maxWidth: 760, margin: '16px auto', padding: 18, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
    <strong>Loading diagnostics</strong>
    <p style={{ color: 'var(--fg2)', margin: '8px 0' }}>Timings only — no tokens, email addresses or account IDs.</p>
    <button className="fc-action-btn fc-action-secondary" onClick={capture}>Copy timing report</button>
    {copied && <span role="status" style={{ marginLeft: 12 }}>Copied</span>}
    {report && <details open style={{ marginTop: 12 }}><summary>Timing report</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, maxHeight: 320, overflow: 'auto' }}>{report}</pre></details>}
  </aside>;
}

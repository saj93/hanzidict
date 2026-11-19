'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import situations from '../../../content/phrasebook/situations.json';
import { UNITS } from '../../../content/units';

// Precompute free phrase count per situation
const FREE_PHRASE_COUNTS = Object.fromEntries(
  situations.map(s => [
    s.id,
    s.sections.reduce((n, sec) => n + sec.phrases.filter(p => p.free).length, 0),
  ])
);

export default function LearningPathPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [units, setUnits] = useState(UNITS.map((u, i) => ({ ...u, completed: false, unlocked: i === 0 })));
  const [streak, setStreak] = useState(0);

  useEffect(() => { document.title = 'Learning path — HanziDict'; }, []);

  useEffect(() => {
    if (authLoading) return;
    const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
    fetch('/api/learn/units', { headers, cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.units) setUnits(d.units);
        if (d.streak) setStreak(d.streak);
      })
      .catch(() => {});
  }, [authLoading, user, session]);

  function handleStart(unit) {
    if (!user) { router.push('/login?next=/learn/path'); return; }
    router.push(`/learn/${unit.id}`);
  }

  return (
    <main>
      <Nav hideScript />

      <div className="learn-path-wrap learn-curriculum">
        <Link href="/learn" className="learn-hub-back">← Learn</Link>
        <div className="learn-path-header">
          <h1 className="learn-path-title">Learning path</h1>
          <p className="learn-path-sub">
            11 thematic units. Phrases, vocabulary, and practice — one topic at a time.
          </p>
          {streak > 0 && (
            <div className="learn-streak-banner">
              🔥 <strong>{streak}-day streak</strong> — keep it going!
            </div>
          )}
          {!user && (
            <div className="learn-login-prompt">
              <button className="lp-login-link" onClick={() => router.push('/login?next=/learn/path')}>
                Log in
              </button>{' '}to track progress and unlock units.
            </div>
          )}
        </div>

        <div className="learn-path-list">
          {units.map(unit => {
            const phraseCount = FREE_PHRASE_COUNTS[unit.situation] ?? 0;
            const verbCount = unit.verbEnd - unit.verbStart + 1;

            return (
              <div
                key={unit.id}
                className={`learn-unit-row${unit.completed ? ' completed' : ''}${!unit.unlocked ? ' locked' : ''}`}
              >
                <div className="learn-unit-icon">
                  {unit.completed ? '✓' : !unit.unlocked ? '🔒' : String(unit.id)}
                </div>
                <div className="learn-unit-content">
                  <div className="learn-unit-title">{unit.title}</div>
                  <div className="learn-unit-meta">{verbCount} verbs · {phraseCount} phrases</div>
                </div>
                <button
                  className={`learn-unit-btn${!unit.unlocked ? ' learn-unit-btn--locked' : ''}${unit.completed ? ' learn-unit-btn--done' : ''}`}
                  onClick={() => unit.unlocked && handleStart(unit)}
                  disabled={!unit.unlocked}
                >
                  {!unit.unlocked ? 'Locked' : unit.completed ? 'Review →' : 'Start →'}
                </button>
              </div>
            );
          })}
        </div>

      </div>

      <Footer />
    </main>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import { useSimpToTrad } from '../../hooks/useSimpToTrad';
import Footer from '../../components/Footer';
import SituationBrowser from '../../components/SituationBrowser';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../components/AuthProvider';
import situations from '../../../content/phrasebook/situations.json';

export default function SituationPage() {
  const { id }    = useParams();
  const router    = useRouter();
  const { isPremium, loading: subLoading } = useSubscription();
  const { isAdmin, session } = useAuth() ?? {};
  const [script, setScript] = useState('simplified');
  const toTraditional = useSimpToTrad(script);

  useEffect(() => {
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
    const handler = e => setScript(e.detail);
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  const situation = situations.find(s => s.id === id);

  useEffect(() => {
    if (situation) document.title = `${situation.title} — HanziDict`;
    return () => { document.title = 'HanziDict — Chinese Dictionary'; };
  }, [situation?.title]);

  const upgrade = useCallback(() => router.push('/pricing'), [router]);

  if (!situation) {
    return (
      <main>
        <Nav />
        <div className="pb-sit-wrap">
          <button className="pb-sit-back" onClick={() => router.push('/phrasebook')}>← Phrasebook</button>
          <p style={{ color: 'var(--fg3)', marginTop: 24 }}>Situation not found.</p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Nav />

      <div className="pb-sit-wrap">
        <button className="pb-sit-back" onClick={() => router.push('/phrasebook')}>
          ← Phrasebook
        </button>

        <div className="pb-sit-header">
          <div className="pb-sit-header-top">
            <div>
              <div className="pb-sit-chinese">{toTraditional(situation.titleChinese)}</div>
              <div className="pb-sit-title">{situation.title}</div>
              <div className="pb-sit-pinyin">{situation.pinyin}</div>
            </div>
          </div>
        </div>

        <SituationBrowser
          situation={situation}
          isPremium={isPremium || subLoading}
          isAdmin={isAdmin}
          session={session}
          script={script}
          onUpgrade={upgrade}
        />
      </div>

      <Footer />
    </main>
  );
}

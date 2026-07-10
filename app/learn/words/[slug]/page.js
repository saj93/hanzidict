'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { convertPinyin } from '../../../../lib/pinyin';
import Nav from '../../../components/Nav';
import Footer from '../../../components/Footer';
import NewsletterForm from '../../../components/NewsletterForm';
import AudioButton from '../../../components/AudioButton';
import { THEMES, WORD_DATA } from '../../../../content/words';

export default function WordThemePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug;

  const theme = THEMES.find(t => t.slug === slug);
  const data = WORD_DATA[slug];

  useEffect(() => {
    if (theme) document.title = `${theme.title} — Words by Topic — HanziDict`;
  }, [theme]);

  if (!theme || !data) {
    return (
      <main>
        <Nav />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--fg3)' }}>
          Theme not found.
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Nav />
      <div className="words-theme-page">
        <div className="words-theme-header">
          <button className="words-back-btn" onClick={() => router.push('/learn/words')}>
            ← Words by Topic
          </button>
          <div className="words-theme-title-row">
            <span className="words-theme-chinese">{theme.chinese}</span>
            <div>
              <h1 className="words-theme-title">{theme.title}</h1>
              <p className="words-theme-pinyin">{convertPinyin(theme.pinyin)}</p>
            </div>
          </div>
        </div>

        {data.sections.map(sec => (
          <div key={sec.heading} className="words-section">
            <h2 className="words-section-heading">{sec.heading}</h2>
            <div className="words-list">
              {sec.words.map(word => (
                <WordRow key={word.s} word={word} onNavigate={s => router.push(`/word/${encodeURIComponent(s)}`)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <NewsletterForm />
      <Footer />
    </main>
  );
}

function WordRow({ word, onNavigate }) {
  return (
    <div className="wl-entry">
      <div
        className="wl-card"
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(word.s)}
        onKeyDown={e => e.key === 'Enter' && onNavigate(word.s)}
      >
        <div className="wl-body">
          <div className="wl-hanzi">{word.s}</div>
          <div className="wl-sub">
            <span className="wl-pinyin">{convertPinyin(word.py)}</span>
            <span className="wl-dot">·</span>
            <span className="wl-def">{word.en}</span>
          </div>
        </div>
        <span className="wl-audio" onClick={e => e.stopPropagation()}>
          <AudioButton text={word.s} />
        </span>
      </div>
      {word.note && <p className="wl-note">{word.note}</p>}
      {word.variant && (
        <div className="wl-variant">
          <span>also:</span>
          <button className="wl-variant-link" onClick={() => onNavigate(word.variant.s)}>
            {word.variant.s}
          </button>
          {word.variant.label && <span className="wl-variant-desc">({word.variant.label})</span>}
        </div>
      )}
    </div>
  );
}

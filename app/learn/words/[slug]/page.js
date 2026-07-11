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
          <div className="words-sit-header">
            <div className="words-sit-chinese">{theme.chinese}</div>
            <h1 className="words-sit-title">{theme.title}</h1>
            <p className="words-sit-pinyin">{convertPinyin(theme.pinyin)}</p>
          </div>
        </div>

        {data.sections.map(sec => (
          <div key={sec.heading} className="words-section">
            <div className="pb-section-title">{sec.heading}</div>
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
  const hanziDisplay = word.variant ? `${word.s} / ${word.variant.s}` : word.s;
  const pinyinDisplay = word.variant
    ? `${convertPinyin(word.py)} / ${convertPinyin(word.variant.py)}`
    : convertPinyin(word.py);

  return (
    <div className="wl-entry">
      <div
        className="wl-row"
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(word.s)}
        onKeyDown={e => e.key === 'Enter' && onNavigate(word.s)}
      >
        <span className="wl-hanzi">{hanziDisplay}</span>
        <span className="wl-pinyin">{pinyinDisplay}</span>
        <span className="wl-def">{word.en}</span>
        {word.variant?.label && (
          <span className="wl-badge" onClick={e => e.stopPropagation()}>{word.variant.label}</span>
        )}
        <span className="wl-audio" onClick={e => e.stopPropagation()}>
          <AudioButton text={word.s} />
        </span>
      </div>
      {word.note && (
        <div className="wl-note-block">
          <span className="wl-note-icon">💡</span>
          <p>{word.note}</p>
        </div>
      )}
    </div>
  );
}

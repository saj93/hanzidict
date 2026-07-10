'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../../lib/pinyin';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import NewsletterForm from '../../components/NewsletterForm';
import { THEMES } from '../../../content/words';

export default function WordsIndexPage() {
  const router = useRouter();
  useEffect(() => { document.title = 'Words by Topic — HanziDict'; }, []);

  return (
    <main>
      <Nav />
      <div className="words-index-page">
        <div className="words-index-header">
          <h1 className="words-index-title">Words by Topic</h1>
          <p className="words-index-sub">
            Essential vocabulary grouped by theme — study one topic at a time or jump to what you need.
          </p>
        </div>
        <div className="words-theme-grid">
          {THEMES.map(t => (
            <button
              key={t.slug}
              className="words-theme-card"
              onClick={() => router.push(`/learn/words/${t.slug}`)}
            >
              <div className="wtc-top">
                <span className="wtc-chinese">{t.chinese}</span>
                <span className="wtc-arrow">→</span>
              </div>
              <div className="wtc-title">{t.title}</div>
              <div className="wtc-pinyin">{convertPinyin(t.pinyin)}</div>
              <div className="wtc-desc">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <NewsletterForm />
      <Footer />
    </main>
  );
}

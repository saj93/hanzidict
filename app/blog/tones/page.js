'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from '../../components/UserMenu';
import { useAuth } from '../../components/AuthProvider';
import NavSearch from '../../components/NavSearch';
import Footer from '../../components/Footer';
import NewsletterForm from '../../components/NewsletterForm';
import AudioButton from '../../components/AudioButton';

const TONES = [
  {
    number: 1,
    mark: '—',
    name: 'First tone',
    desc: 'High and level. Stay up at the top of your range and hold steady — like a musical note held flat.',
    pinyin: 'mā',
    char: '妈',
    meaning: 'mother',
    color: '#4f9ef7',
    audio: '妈',
  },
  {
    number: 2,
    mark: '/',
    name: 'Second tone',
    desc: 'Rising. Like asking "huh?" in English — your pitch goes up, as if surprised or questioning.',
    pinyin: 'má',
    char: '麻',
    meaning: 'hemp / numb',
    color: '#34c77b',
    audio: '麻',
  },
  {
    number: 3,
    mark: 'V',
    name: 'Third tone',
    desc: 'Dipping. Your pitch drops low then bounces back up. Think of it as a valley shape. In casual speech before another syllable, it often stays low without the final rise.',
    pinyin: 'mǎ',
    char: '马',
    meaning: 'horse',
    color: '#f5a623',
    audio: '马',
  },
  {
    number: 4,
    mark: '\\',
    name: 'Fourth tone',
    desc: 'Falling sharply. Short and decisive — like a firm command or the word "stop!" in English.',
    pinyin: 'mà',
    char: '骂',
    meaning: 'to scold',
    color: '#e85555',
    audio: '骂',
  },
];

const PAIRS = [
  {
    a: { char: '买', pinyin: 'mǎi', tone: 3, meaning: 'to buy', audio: '买' },
    b: { char: '卖', pinyin: 'mài', tone: 4, meaning: 'to sell', audio: '卖' },
    note: 'A single tone separates buyer from seller.',
  },
  {
    a: { char: '水饺', pinyin: 'shuǐjiǎo', tone: '3-3', meaning: 'dumplings (boiled)', audio: '水饺' },
    b: { char: '睡觉', pinyin: 'shuìjiào', tone: '4-4', meaning: 'to sleep', audio: '睡觉' },
    note: 'A classic mix-up — ordering dumplings and asking for sleep sounds very similar.',
  },
  {
    a: { char: '联系', pinyin: 'liánxì', tone: '2-4', meaning: 'to contact / get in touch', audio: '联系' },
    b: { char: '练习', pinyin: 'liànxí', tone: '4-2', meaning: 'to practise / practice', audio: '练习' },
    note: 'Same consonants and vowels, reversed tones — easy to confuse in fast speech.',
  },
];

const TONE_COLORS = { 1: '#4f9ef7', 2: '#34c77b', 3: '#f5a623', 4: '#e85555' };

function TonedPinyin({ pinyin, tone }) {
  return (
    <span style={{ color: TONE_COLORS[tone] || 'inherit', fontWeight: 600 }}>{pinyin}</span>
  );
}

export default function TonesPage() {
  const router = useRouter();
  const { user } = (useAuth() as any) ?? {};
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link active" onClick={() => router.push('/blog')}>Blog</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link active" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}

      <article className="blog-post">
        <div className="blog-post-header">
          <div className="blog-card-meta">
            <span className="blog-tag">Linguistics</span>
            <span className="blog-level">Beginner–Intermediate</span>
          </div>
          <h1 className="blog-post-title">Mandarin Tones: Hear the Difference</h1>
          <p className="blog-post-desc">
            Tones are the hardest part of Mandarin for most learners — not because the sounds are difficult,
            but because the concept is unfamiliar. This guide explains each tone with audio so you can hear
            exactly what you're aiming for, plus minimal pairs that show why getting tones right matters.
          </p>
        </div>

        <div className="blog-post-body">

          <h2>The Four Tones</h2>
          <p>
            Mandarin has four tones (plus a neutral tone for unstressed syllables). The same syllable
            spoken in different tones is a completely different word — meaning comes from tone as much
            as from consonants and vowels.
          </p>
          <p>
            The classic example is <em>ma</em> — one syllable, four completely different words:
          </p>

          <div className="tones-grid">
            {TONES.map(t => (
              <div key={t.number} className="tone-card" style={{ borderTopColor: t.color }}>
                <div className="tone-card-top">
                  <div className="tone-number" style={{ color: t.color }}>Tone {t.number}</div>
                  <div className="tone-name">{t.name}</div>
                  <div className="tone-mark" style={{ color: t.color }}>{t.mark}</div>
                </div>
                <div className="tone-pinyin" style={{ color: t.color }}>{t.pinyin}</div>
                <div className="tone-char-row">
                  <span className="tone-char">{t.char}</span>
                  <span className="tone-meaning">{t.meaning}</span>
                  <AudioButton text={t.audio} />
                </div>
                <p className="tone-desc">{t.desc}</p>
              </div>
            ))}
          </div>

          <h2>Minimal Pairs</h2>
          <p>
            Minimal pairs are pairs of words that differ only in tone. They show exactly how much
            rides on getting the tone right — a single tonal shift changes the word entirely.
          </p>

          <div className="tone-pairs">
            {PAIRS.map((pair, i) => (
              <div key={i} className="tone-pair-card">
                <div className="tone-pair-row">
                  <div className="tone-pair-item">
                    <div className="tone-pair-char">{pair.a.char}</div>
                    <div className="tone-pair-pinyin">
                      <TonedPinyin pinyin={pair.a.pinyin} tone={typeof pair.a.tone === 'number' ? pair.a.tone : 0} />
                    </div>
                    <div className="tone-pair-meaning">{pair.a.meaning}</div>
                    <AudioButton text={pair.a.audio} />
                  </div>
                  <div className="tone-pair-vs">vs</div>
                  <div className="tone-pair-item">
                    <div className="tone-pair-char">{pair.b.char}</div>
                    <div className="tone-pair-pinyin">
                      <TonedPinyin pinyin={pair.b.pinyin} tone={typeof pair.b.tone === 'number' ? pair.b.tone : 0} />
                    </div>
                    <div className="tone-pair-meaning">{pair.b.meaning}</div>
                    <AudioButton text={pair.b.audio} />
                  </div>
                </div>
                <p className="tone-pair-note">{pair.note}</p>
              </div>
            ))}
          </div>

          <h2>Tone Sandhi: When Tones Change</h2>
          <p>
            Tones don't always sound in isolation the way they look on paper. The most common change
            is the <strong>third-tone sandhi rule</strong>: when two third-tone syllables appear in a
            row, the first one is pronounced as a second tone.
          </p>
          <p>
            The most famous example is <strong>你好</strong> — the standard greeting:
          </p>

          <div className="sandhi-block">
            <div className="sandhi-item">
              <div className="sandhi-label">Written</div>
              <div className="sandhi-hanzi">你好</div>
              <div className="sandhi-pinyin">nǐ hǎo</div>
              <div className="sandhi-note">Both marked as third tone</div>
              <AudioButton text="你好" />
            </div>
            <div className="sandhi-arrow">→</div>
            <div className="sandhi-item">
              <div className="sandhi-label">Spoken</div>
              <div className="sandhi-hanzi">你好</div>
              <div className="sandhi-pinyin" style={{ color: TONE_COLORS[2] }}>ní hǎo</div>
              <div className="sandhi-note">First syllable rises to second tone</div>
              <AudioButton text="你好" />
            </div>
          </div>

          <p>
            The same rule applies anywhere two third tones meet: 也许 <em>yěxǔ</em> (perhaps),
            所以 <em>suǒyǐ</em> (so/therefore), 你好 <em>nǐhǎo</em>. The written pinyin shows
            the underlying tones; the actual pronunciation shifts.
          </p>
          <p>
            不 <em>bù</em> (no/not) has its own sandhi: before a fourth tone, it changes from
            fourth to second.
          </p>
          <blockquote>
            不是 <em>bú shì</em> (is not) — 不 changes to second tone before 是 (fourth tone)<br />
            不好 <em>bù hǎo</em> (not good) — 不 stays fourth before a third tone
          </blockquote>

          <h2>Tips for Learning Tones</h2>

          <h3>1. Learn tones with vocabulary, not in isolation</h3>
          <p>
            Don't practise tones on meaningless syllables. Learn each new word with its tone baked in
            from the start — "mā means mother" not "mā is first tone." The meaning gives you a memory hook.
          </p>

          <h3>2. Exaggerate at first</h3>
          <p>
            Native speakers' tones are smaller and faster than textbook examples. When you're starting,
            make your tones large and deliberate. Exaggerated tones are always intelligible; flat,
            uniform tones are not.
          </p>

          <h3>3. Record yourself</h3>
          <p>
            Your internal perception of your own voice is unreliable. What sounds like a clear rising
            tone to you might sound flat to a listener. Recording and listening back — even just on your
            phone — reveals discrepancies you'd never catch otherwise.
          </p>

          <h3>4. Tones matter most for content words</h3>
          <p>
            In real speech, context carries a lot of weight. Tonal errors on common words in predictable
            contexts (ordering food, introducing yourself) are usually understood. Where tones matter most
            is in content words used out of context — new vocabulary, names, or words you're introducing
            into a conversation for the first time.
          </p>

          <h3>5. Neutral tone words sound different in different contexts</h3>
          <p>
            The neutral tone (short and unstressed, written without a tone mark) adapts its pitch to
            the tone that precedes it. 吗 *ma* after a first tone sounds different from 吗 *ma* after
            a fourth tone. This isn't something to analyse — it happens automatically when you listen
            and imitate enough native speech.
          </p>

        </div>

        <div className="blog-post-footer">
          <button className="blog-back" onClick={() => router.push('/blog')}>← All articles</button>
        </div>
      </article>

      <NewsletterForm />
      <Footer />
    </main>
  );
}

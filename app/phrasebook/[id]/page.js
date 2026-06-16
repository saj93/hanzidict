'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AudioButton from '../../components/AudioButton';
import { useSubscription } from '../../hooks/useSubscription';
import situations from '../../../content/phrasebook/situations.json';

// ── Constants ────────────────────────────────────────────────────────────────

const BADGE_CONFIG = {
  everyday:   { label: '🗣️ Everyday',   cls: 'pb-badge-everyday'   },
  textbook:   { label: '📚 Textbook',   cls: 'pb-badge-textbook'   },
  polite:     { label: '🤝 Polite',     cls: 'pb-badge-polite'     },
  colloquial: { label: '💬 Colloquial', cls: 'pb-badge-colloquial' },
  regional:   { label: '🌏 Regional',   cls: 'pb-badge-regional'   },
};

const TYPE_CLS = {
  'Q':   'pb-type-q',
  'A':   'pb-type-a',
  'Q/A': 'pb-type-qa',
  'A/Q': 'pb-type-qa',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuiz(situation) {
  const freePhrases = situation.sections
    .flatMap(s => s.phrases.filter(p => p.free));
  if (freePhrases.length < 2) return null;

  // All free phrases across all situations for distractor pool
  const allFree = situations
    .flatMap(s => s.sections.flatMap(sec => sec.phrases.filter(p => p.free)));

  return shuffle(freePhrases).map(phrase => {
    const pool = allFree.filter(p => p.hanzi !== phrase.hanzi);
    const distractors = shuffle(pool).slice(0, 3);
    const options = shuffle([phrase, ...distractors]);
    return { phrase, options, correctIdx: options.indexOf(phrase) };
  });
}

// ── Note block ───────────────────────────────────────────────────────────────

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

function NoteBlock({ note }) {
  if (!note) return null;
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>);
      listItems = [];
    }
  }

  note.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('- ')) {
      listItems.push(<li key={i}>{renderInline(line.slice(2))}</li>);
    } else {
      flushList();
      blocks.push(<p key={i}>{renderInline(line)}</p>);
    }
  });
  flushList();

  return (
    <div className="pb-note">
      <span className="pb-note-icon">💡</span>
      <div className="pb-note-body">{blocks}</div>
    </div>
  );
}

// ── Phrase row ───────────────────────────────────────────────────────────────

function PhraseRow({ phrase }) {
  const badge = BADGE_CONFIG[phrase.badge] || BADGE_CONFIG.common;
  const typeCls = TYPE_CLS[phrase.type] || 'pb-type-qa';

  return (
    <div className="pb-phrase">
      <div className={`pb-type-pill ${typeCls}`}>{phrase.type}</div>

      <div className="pb-phrase-body">
        <div className="pb-phrase-hanzi">{phrase.hanzi}</div>
        <div className="pb-phrase-pinyin">{phrase.pinyin}</div>
        <div className="pb-phrase-english">{phrase.english}</div>
        <div className="pb-phrase-pills">
          <span className={`pb-phrase-badge ${badge.cls}`}>{badge.label}</span>
          {phrase.badgeNote && (
            <span className="pb-phrase-badge-note">{phrase.badgeNote}</span>
          )}
        </div>
      </div>

      <div className="pb-phrase-audio">
        <AudioButton text={phrase.hanzi} />
      </div>
    </div>
  );
}

// ── Locked block ─────────────────────────────────────────────────────────────

function LockedBlock({ phrases, onUpgrade }) {
  if (!phrases.length) return null;
  return (
    <div className="pb-locked-wrap">
      {phrases.map((phrase, i) => (
        <div key={i} className="pb-phrase pb-phrase-blurred" aria-hidden="true">
          <div className="pb-type-pill pb-type-qa">Q/A</div>
          <div className="pb-phrase-body">
            <div className="pb-phrase-hanzi pb-blur-text">{phrase.hanzi}</div>
            <div className="pb-phrase-pinyin pb-blur-light">{phrase.pinyin}</div>
            <div className="pb-phrase-english">{phrase.english}</div>
          </div>
          <div className="pb-phrase-audio" />
        </div>
      ))}
      <button className="pb-unlock-btn" onClick={onUpgrade}>
        🔒 Unlock {phrases.length} more phrase{phrases.length !== 1 ? 's' : ''} →
      </button>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ section, isPremium, onUpgrade }) {
  const freePhrases = section.phrases.filter(p => p.free);
  const lockedPhrases = section.phrases.filter(p => !p.free);
  const shownPhrases = isPremium ? section.phrases : freePhrases;

  return (
    <div className="pb-section">
      <div className="pb-section-title">{section.title}</div>
      {section.note && <NoteBlock note={section.note} />}
      {shownPhrases.map((phrase, i) => (
        <PhraseRow key={i} phrase={phrase} />
      ))}
      {!isPremium && lockedPhrases.length > 0 && (
        <LockedBlock phrases={lockedPhrases} onUpgrade={onUpgrade} />
      )}
    </div>
  );
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

function QuizDone({ score, total, onRetry, onBrowse }) {
  const pct = total ? score / total : 0;
  const emoji = pct === 1 ? '🎉' : pct >= 0.7 ? '👍' : pct >= 0.4 ? '📚' : '💪';
  const msg   = pct === 1 ? 'Perfect score!' : pct >= 0.7 ? 'Great job!' : pct >= 0.4 ? 'Keep practising!' : 'Don\'t give up!';

  return (
    <div className="pb-quiz-done">
      <div className="pb-quiz-done-emoji">{emoji}</div>
      <div className="pb-quiz-done-score">{score} / {total}</div>
      <div className="pb-quiz-done-msg">{msg}</div>
      <div className="pb-quiz-done-actions">
        <button className="pb-quiz-retry" onClick={onRetry}>Try again</button>
        <button className="pb-quiz-browse" onClick={onBrowse}>← Back to phrases</button>
      </div>
    </div>
  );
}

function Quiz({ questions: initialQuestions, onDone }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [current, setCurrent]     = useState(0);
  const [selected, setSelected]   = useState(null);
  const [score, setScore]         = useState(0);
  const [finished, setFinished]   = useState(false);

  const q = questions[current];

  function select(idx) {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.correctIdx) setScore(s => s + 1);
  }

  function next() {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }

  function retry() {
    // Re-shuffle for a fresh attempt
    setQuestions(qs => shuffle(qs).map(q => {
      const opts = shuffle(q.options);
      return { ...q, options: opts, correctIdx: opts.indexOf(q.phrase) };
    }));
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <QuizDone
        score={score}
        total={questions.length}
        onRetry={retry}
        onBrowse={onDone}
      />
    );
  }

  const pct = current / questions.length;

  return (
    <div className="pb-quiz">
      {/* Header: back + progress */}
      <div className="pb-quiz-header">
        <button className="pb-quiz-back" onClick={onDone}>← Phrases</button>
        <div className="pb-quiz-prog-wrap">
          <div className="pb-quiz-prog-fill" style={{ width: `${pct * 100}%` }} />
        </div>
        <span className="pb-quiz-counter">{current + 1} / {questions.length}</span>
      </div>

      {/* Prompt */}
      <div className="pb-quiz-prompt">
        <div className="pb-quiz-label">What's the Chinese for…</div>
        <div className="pb-quiz-english">{q.phrase.english}</div>
      </div>

      {/* Options */}
      <div className="pb-quiz-options">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIdx;
          const isSelected = selected === i;
          const revealed = selected !== null;
          let cls = 'pb-quiz-option';
          if (revealed) {
            if (isCorrect) cls += ' correct';
            else if (isSelected) cls += ' wrong';
            else cls += ' dimmed';
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => select(i)}
              disabled={revealed}
            >
              <div className="pb-quiz-opt-hanzi">{opt.hanzi}</div>
              <div className="pb-quiz-opt-pinyin">{opt.pinyin}</div>
            </button>
          );
        })}
      </div>

      {/* Feedback + Next */}
      {selected !== null && (
        <div className="pb-quiz-next-wrap">
          {selected === q.correctIdx ? (
            <div className="pb-quiz-feedback correct">✓ Correct!</div>
          ) : (
            <div className="pb-quiz-feedback wrong">
              ✗ It was: <strong>{q.phrase.hanzi}</strong> — {q.phrase.pinyin}
            </div>
          )}
          <button className="pb-quiz-next" onClick={next}>
            {current + 1 >= questions.length ? 'See results →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Vocab list ────────────────────────────────────────────────────────────────

function VocabSection({ vocabCards }) {
  if (!vocabCards || !vocabCards.length) return null;
  const items = vocabCards.flatMap(g => g.items);
  return (
    <div className="pb-vocab-section">
      <div className="pb-vocab-header">Useful vocabulary</div>
      <ul className="pb-vocab-list">
        {items.map((item, i) => (
          <li key={i}>
            <Link href={`/word/${encodeURIComponent(item.hanzi)}`} className="pb-vocab-item">
              <span className="pb-vocab-hanzi">{item.hanzi}</span>
              <span className="pb-vocab-pinyin">{item.pinyin}</span>
              <span className="pb-vocab-english">{item.english}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SituationPage() {
  const { id }    = useParams();
  const router    = useRouter();
  const { isPremium } = useSubscription();
  const [mode, setMode] = useState('browse'); // 'browse' | 'quiz'

  const situation = situations.find(s => s.id === id);

  useEffect(() => {
    if (situation) document.title = `${situation.title} — HanziDict`;
    return () => { document.title = 'HanziDict — Chinese Dictionary'; };
  }, [situation?.title]);

  const quiz = useMemo(
    () => situation ? buildQuiz(situation) : null,
    [situation]
  );

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

  const hasPremiumContent = situation.sections.some(s => s.phrases.some(p => !p.free));

  return (
    <main>
      <Nav />

      <div className="pb-sit-wrap">

        {mode === 'quiz' ? (
          /* ── Quiz mode ── */
          quiz ? (
            <Quiz questions={quiz} onDone={() => setMode('browse')} />
          ) : (
            <p style={{ color: 'var(--fg3)' }}>Not enough phrases to build a quiz.</p>
          )
        ) : (
          /* ── Browse mode ── */
          <>
            <button className="pb-sit-back" onClick={() => router.push('/phrasebook')}>
              ← Phrasebook
            </button>

            {/* Header */}
            <div className="pb-sit-header">
              <div className="pb-sit-header-top">
                <div>
                  <div className="pb-sit-chinese">{situation.titleChinese}</div>
                  <div className="pb-sit-title">{situation.title}</div>
                  <div className="pb-sit-pinyin">{situation.pinyin}</div>
                </div>
                {quiz && (
                  <button className="pb-practice-btn" onClick={() => setMode('quiz')}>
                    ✏️ Practice
                  </button>
                )}
              </div>
            </div>

            {/* Sections */}
            {situation.sections.map((section, si) => (
              <Section
                key={si}
                section={section}
                isPremium={isPremium}
                onUpgrade={upgrade}
              />
            ))}

            {/* Vocab cards — free for all users */}
            {situation.vocabCards && (
              <VocabSection vocabCards={situation.vocabCards} />
            )}

            {/* Bottom upgrade CTA */}
            {hasPremiumContent && !isPremium && (
              <div className="pb-upgrade-banner">
                <div className="pb-upgrade-title">🔒 Unlock all phrases</div>
                <div className="pb-upgrade-sub">
                  See all {situation.phraseCount} phrases — including natural reactions, nuanced responses, and cultural notes.
                </div>
                <button className="pb-upgrade-btn" onClick={upgrade}>
                  Upgrade to Premium
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {mode === 'browse' && <Footer />}
    </main>
  );
}

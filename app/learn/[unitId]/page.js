'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AudioButton from '../../components/AudioButton';
import SituationBrowser from '../../components/SituationBrowser';
import { useAuth } from '../../components/AuthProvider';
import { useSubscription } from '../../hooks/useSubscription';
import { UNITS } from '../../../content/units';
import verbs from '../../../content/verbs.json';
import situations from '../../../content/phrasebook/situations.json';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_FREE_PHRASES = situations.flatMap(s =>
  s.sections.flatMap(sec => sec.phrases.filter(p => p.free))
);

function buildQuiz(freePhrases) {
  if (freePhrases.length < 2) return [];
  return shuffle(freePhrases).map(phrase => {
    const pool = ALL_FREE_PHRASES.filter(p => p.hanzi !== phrase.hanzi);
    const distractors = shuffle(pool).slice(0, 3);
    const options = shuffle([phrase, ...distractors]);
    return { phrase, options, correctIdx: options.indexOf(phrase) };
  });
}

// ── Rating buttons ────────────────────────────────────────────────────────────

const RATINGS = [
  { label: 'Again', color: '#e53e3e', key: 'again' },
  { label: 'Hard',  color: '#dd6b20', key: 'hard'  },
  { label: 'Good',  color: '#1D9E75', key: 'good'  },
  { label: 'Easy',  color: '#3182ce', key: 'easy'  },
];

// ── Verb row (ranked verbs fallback) ─────────────────────────────────────────

function VerbRow({ verb }) {
  const router = useRouter();
  return (
    <div
      className="verb-row"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/word/${encodeURIComponent(verb.simplified)}`)}
      onKeyDown={e => e.key === 'Enter' && router.push(`/word/${encodeURIComponent(verb.simplified)}`)}
    >
      <span className="verb-rank">{verb.rank}</span>
      <span className="verb-hanzi">{verb.simplified}</span>
      <span className="verb-pinyin">{verb.pinyin}</span>
      <span className="verb-audio" onClick={e => e.stopPropagation()}>
        <AudioButton text={verb.simplified} />
      </span>
      <span className="verb-def">{verb.meaning}</span>
    </div>
  );
}

// ── Vocab row (situation vocabulary — no rank) ────────────────────────────────

function VocabRow({ item }) {
  const router = useRouter();
  return (
    <div
      className="verb-row vocab-row"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/word/${encodeURIComponent(item.hanzi)}`)}
      onKeyDown={e => e.key === 'Enter' && router.push(`/word/${encodeURIComponent(item.hanzi)}`)}
    >
      <span className="verb-hanzi">{item.hanzi}</span>
      <span className="verb-pinyin">{item.pinyin}</span>
      <span className="verb-audio" onClick={e => e.stopPropagation()}>
        <AudioButton text={item.hanzi} />
      </span>
      <span className="verb-def">{item.english}</span>
    </div>
  );
}

// ── Verb flashcards ───────────────────────────────────────────────────────────

function VerbFlashcards({ cards, onDone }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState({});

  const card = cards[idx];
  const progressPct = cards.length ? idx / cards.length : 0;

  function rate(key) {
    const next = { ...rated, [idx]: key };
    setRated(next);
    if (idx + 1 >= cards.length) {
      onDone();
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  }

  return (
    <div>
      <div className="lp-session-topbar">
        <div className="unit-practice-phase-label">⚡ Verbs · {idx + 1} / {cards.length}</div>
        <div className="lp-session-prog-wrap">
          <div className="lp-session-prog-fill" style={{ width: `${progressPct * 100}%` }} />
        </div>
      </div>
      <div className="fc-study-wrap">
        <div className="fc-card-scene">
          <div className={`fc-card-inner${flipped ? ' flipped' : ''}`}>
            <div className="fc-face fc-front">
              <div className="fc-char">{card.simplified}</div>
              <div className="fc-front-audio"><AudioButton text={card.simplified} /></div>
              {!flipped && (
                <button className="fc-show-btn" onClick={() => setFlipped(true)}>
                  Show answer
                </button>
              )}
            </div>
            <div className="fc-face fc-back">
              <div className="fc-char fc-char-sm">{card.simplified}</div>
              <div className="fc-pinyin-row">
                <div className="fc-pinyin">{card.pinyin}</div>
                <AudioButton text={card.simplified} />
              </div>
              <div className="fc-defs">
                <div className="fc-def-row">
                  <span className="fc-def-n">1</span>
                  <span className="fc-def-text">{card.meaning}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={`fc-ratings${flipped ? ' visible' : ''}`}>
          {RATINGS.map(r => (
            <button
              key={r.key}
              className="fc-rate-btn"
              style={{ '--rate-color': r.color }}
              onClick={() => rate(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phrase quiz ───────────────────────────────────────────────────────────────

function PhraseQuiz({ questions: initialQ, onComplete }) {
  const [questions, setQuestions] = useState(initialQ);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[current];

  function select(i) {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.correctIdx) setScore(s => s + 1);
  }

  function next() {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }

  if (finished) {
    const pct = questions.length ? score / questions.length : 0;
    const emoji = pct === 1 ? '🎉' : pct >= 0.7 ? '👍' : '📚';
    const msg = pct === 1 ? 'Perfect score!' : pct >= 0.7 ? 'Great job!' : 'Keep practising!';
    return (
      <div className="pb-quiz-done">
        <div className="pb-quiz-done-emoji">{emoji}</div>
        <div className="pb-quiz-done-score">{score} / {questions.length}</div>
        <div className="pb-quiz-done-msg">{msg}</div>
        <div className="pb-quiz-done-actions">
          <button className="pb-quiz-next" onClick={onComplete}>
            Complete unit →
          </button>
        </div>
      </div>
    );
  }

  const pct = current / questions.length;

  return (
    <div className="pb-quiz">
      <div className="pb-quiz-header">
        <div className="unit-practice-phase-label">💬 Phrases · {current + 1} / {questions.length}</div>
        <div className="pb-quiz-prog-wrap">
          <div className="pb-quiz-prog-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="pb-quiz-prompt">
        <div className="pb-quiz-label">What's the Chinese for…</div>
        <div className="pb-quiz-english">{q.phrase.english}</div>
      </div>
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
            <button key={i} className={cls} onClick={() => select(i)} disabled={revealed}>
              <div className="pb-quiz-opt-hanzi">{opt.hanzi}</div>
              <div className="pb-quiz-opt-pinyin">{opt.pinyin}</div>
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="pb-quiz-next-wrap">
          {selected === q.correctIdx
            ? <div className="pb-quiz-feedback correct">✓ Correct!</div>
            : <div className="pb-quiz-feedback wrong">✗ It was: <strong>{q.phrase.hanzi}</strong> — {q.phrase.pinyin}</div>
          }
          <button className="pb-quiz-next" onClick={next}>
            {current + 1 >= questions.length ? 'See results →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UnitPage() {
  const { unitId } = useParams();
  const unitNum = parseInt(unitId, 10);
  const unit = UNITS.find(u => u.id === unitNum);

  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();

  const [tab, setTab] = useState('phrases'); // 'phrases' | 'vocabulary'
  const [practicePhase, setPracticePhase] = useState('idle'); // idle | verbs | quiz | done
  const [finalStreak, setFinalStreak] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [script, setScript] = useState('simplified');

  useEffect(() => {
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
    const handler = e => setScript(e.detail);
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  useEffect(() => {
    if (unit) document.title = `${unit.title} — HanziDict`;
  }, [unit?.title]);

  const situation = unit ? situations.find(s => s.id === unit.situation) : null;
  const unitVerbs = unit ? verbs.filter(v => v.rank >= unit.verbStart && v.rank <= unit.verbEnd) : [];
  const freePhrases = useMemo(
    () => situation?.sections.flatMap(s => s.phrases.filter(p => p.free)) ?? [],
    [situation]
  );
  const quizQuestions = useMemo(() => buildQuiz(freePhrases), [freePhrases]);
  const practiceCards = useMemo(() => shuffle([...unitVerbs]), [unit?.id]);

  const upgrade = useCallback(() => router.push('/pricing'), [router]);

  async function completeUnit() {
    if (!user || !session) { router.push(`/login?next=/learn/${unitNum}`); return; }
    setCompleting(true);
    try {
      const res = await fetch(`/api/learn/units/${unitNum}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setFinalStreak(data.streak ?? 0);
    } catch (e) {}
    setCompleting(false);
    setPracticePhase('done');
  }

  function startPractice() {
    if (!user) { router.push(`/login?next=/learn/${unitNum}`); return; }
    if (practiceCards.length > 0) {
      setPracticePhase('verbs');
    } else if (quizQuestions.length > 0) {
      setPracticePhase('quiz');
    } else {
      completeUnit();
    }
  }

  if (!unit || !situation) {
    return (
      <main>
        <Nav />
        <div className="unit-wrap">
          <p style={{ color: 'var(--fg3)', marginTop: 40 }}>Unit not found.</p>
        </div>
        <Footer />
      </main>
    );
  }

  const nextUnit = UNITS.find(u => u.id === unitNum + 1);

  // ── Practice section ────────────────────────────────────────────────────────

  function renderPractice() {
    if (practicePhase === 'idle') {
      return (
        <div className="unit-practice-idle">
          <div className="unit-practice-summary">
            <div className="unit-practice-item">⚡ {practiceCards.length} verbs to review</div>
            <div className="unit-practice-item">💬 {quizQuestions.length} phrase questions</div>
          </div>
          {!user ? (
            <button className="lp-start-btn" onClick={() => router.push(`/login?next=/learn/${unitNum}`)}>
              Log in to practise →
            </button>
          ) : (
            <button className="lp-start-btn" onClick={startPractice}>
              Start practice →
            </button>
          )}
        </div>
      );
    }

    if (practicePhase === 'verbs') {
      return (
        <VerbFlashcards
          cards={practiceCards}
          onDone={() => {
            if (quizQuestions.length > 0) setPracticePhase('quiz');
            else completeUnit();
          }}
        />
      );
    }

    if (practicePhase === 'quiz') {
      return <PhraseQuiz questions={quizQuestions} onComplete={completeUnit} />;
    }

    if (practicePhase === 'done') {
      return (
        <div className="unit-done-wrap">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🎉</div>
            <h2 className="fc-done-title">Unit complete!</h2>
            <p className="fc-done-sub">{unit.title}</p>
            {finalStreak > 0 && (
              <div className="lp-done-streak">🔥 {finalStreak}-day streak</div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <button className="fc-action-btn fc-action-secondary" onClick={() => router.push('/learn')}>
                ← Back to path
              </button>
              {nextUnit && (
                <button className="fc-action-btn" onClick={() => router.push(`/learn/${nextUnit.id}`)}>
                  Next unit →
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main>
      <Nav />

      <div className="unit-wrap">
        <button className="unit-back" onClick={() => router.push('/learn')}>← Learning path</button>

        <div className="unit-header">
          <div className="unit-header-chinese">{situation.titleChinese}</div>
          <h1 className="unit-header-title">{unit.title}</h1>
          <div className="unit-header-pinyin">{situation.pinyin}</div>
        </div>

        {/* Tab switcher — Vocabulary tab only appears when the situation has vocab data */}
        <div className="unit-tabs">
          <button
            className={`unit-tab-btn${tab === 'phrases' ? ' active' : ''}`}
            onClick={() => setTab('phrases')}
          >
            📖 Phrases
          </button>
          {situation.vocabCards && (
            <button
              className={`unit-tab-btn${tab === 'vocabulary' ? ' active' : ''}`}
              onClick={() => setTab('vocabulary')}
            >
              ⚡ Vocabulary
            </button>
          )}
        </div>

        {/* Tab: Phrases */}
        {tab === 'phrases' && (
          <div className="unit-section">
            <SituationBrowser
              situation={situation}
              isPremium={isPremium || subLoading}
              isAdmin={false}
              session={null}
              script={script}
              onUpgrade={upgrade}
            />
          </div>
        )}

        {/* Tab: Vocabulary — situation-specific words (only for situations that have them) */}
        {tab === 'vocabulary' && situation.vocabCards && (
          <div className="unit-section">
            {situation.vocabCards.map((group, gi) => (
              <div key={gi}>
                {group.title && (
                  <div className="unit-vocab-header">{group.title}</div>
                )}
                <div className="verbs-list">
                  {group.items.map((item, ii) => (
                    <VocabRow key={ii} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Practice — always visible below tabs */}
        <div className="unit-section">
          <div className="unit-vocab-header">✏️ Practice</div>
          {renderPractice()}
        </div>

        {/* Phrasebook link — always at bottom */}
        <div className="unit-phrasebook-link">
          <button className="unit-phrasebook-btn" onClick={() => router.push('/phrasebook')}>
            Browse the full phrasebook →
          </button>
        </div>
      </div>

      <Footer />
    </main>
  );
}

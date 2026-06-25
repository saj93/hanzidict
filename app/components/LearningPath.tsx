'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase';

const STORAGE_KEY = 'hanzidict-learning-path';

type Level = 'beginner0' | 'beginner1' | 'intermediate' | 'advanced';
type Goal  = 'travel' | 'business' | 'culture' | 'hsk' | 'interest';
type Time  = '5' | '15' | '30';
interface Answers { level: Level; goal: Goal; time: Time; }
interface Step    { icon: string; title: string; desc: string; href: string; cta: string; locked?: boolean; }
// Only answers are persisted; steps are always re-derived so code changes take effect immediately.
type Saved = Answers;

const QUESTIONS = [
  {
    q: "What's your current level?",
    field: 'level' as keyof Answers,
    options: [
      { value: 'beginner0',    emoji: '🌱', label: 'Complete beginner', sub: 'I know nothing'            },
      { value: 'beginner1',    emoji: '🌿', label: 'Beginner',          sub: 'I know a few words/phrases' },
      { value: 'intermediate', emoji: '🌳', label: 'Intermediate',      sub: 'HSK 2–4'                   },
      { value: 'advanced',     emoji: '🎋', label: 'Advanced',          sub: 'HSK 5+'                    },
    ],
  },
  {
    q: "What's your main goal?",
    field: 'goal' as keyof Answers,
    options: [
      { value: 'travel',   emoji: '✈️',  label: 'Travel to China/Taiwan'         },
      { value: 'business', emoji: '💼',  label: 'Business & professional use'    },
      { value: 'culture',  emoji: '🎬',  label: 'Chinese culture & entertainment'},
      { value: 'hsk',      emoji: '📝',  label: 'Pass the HSK exam'              },
      { value: 'interest', emoji: '💡',  label: 'General interest'               },
    ],
  },
  {
    q: 'How much time can you dedicate daily?',
    field: 'time' as keyof Answers,
    options: [
      { value: '5',  emoji: '⚡', label: '5 minutes',   sub: 'Quick daily habit' },
      { value: '15', emoji: '📈', label: '15 minutes',  sub: 'Steady progress'   },
      { value: '30', emoji: '🚀', label: '30 minutes+', sub: 'Fast track'        },
    ],
  },
];

function buildSteps(level: Level, goal: Goal): Step[] {
  const fc = (n: number): Step => ({
    icon: '🃏', title: `HSK ${n} Flashcards`,
    desc: `Study the HSK ${n} vocabulary set with spaced repetition.`,
    href: '/hsk', cta: 'Study →',
  });
  const fcLocked = (label: string): Step => ({
    icon: '🔒', title: label,
    desc: 'Unlock the full advanced deck with a premium account.',
    href: '/pricing', cta: 'Unlock →', locked: true,
  });
  const tones: Step = {
    icon: '🎵', title: 'Guide: Mandarin Tones',
    desc: 'Hear the four tones with audio examples and minimal pairs — the essential foundation for everything else.',
    href: '/blog/tones', cta: 'Read →',
  };
  const blog = (slug: string, title: string, desc: string): Step => ({
    icon: '📖', title, desc, href: `/blog/${slug}`, cta: 'Read →',
  });
  const phrase = (slug: string, title: string, desc: string, locked = false): Step => ({
    icon: locked ? '🔒' : '💬', title, desc,
    href: `/phrasebook/${slug}`, cta: locked ? 'Unlock →' : 'Start →', locked,
  });
  const bizPhrase: Step = {
    icon: '💬', title: 'Business Phrasebook',
    desc: 'Professional Chinese phrases for meetings and networking.',
    href: '/phrasebook/situation-10', cta: 'Start →',
  };
  const verbs: Step = {
    icon: '⚡', title: 'Learn the 100 most common verbs',
    desc: 'The highest-frequency action words in Chinese, ranked by real usage — essential for building sentences.',
    href: '/verbs', cta: 'Start →',
  };

  if (level === 'beginner0') {
    if (goal === 'travel') return [
      tones,
      phrase('situation-1', 'Phrasebook: Greetings', 'Master basic hellos, goodbyes and pleasantries.'),
      verbs,
      phrase('situation-2', 'Phrasebook: Introducing Yourself', "Say your name, where you're from, and more."),
      fc(1),
    ];
    if (goal === 'culture' || goal === 'interest') return [
      tones,
      blog('chinese-characters', 'Guide: Chinese Characters', 'Understand how characters work before you learn them.'),
      phrase('situation-1', 'Phrasebook: Greetings', 'Start speaking from day one.'),
      verbs,
      fc(1),
    ];
    if (goal === 'hsk') return [
      tones,
      blog('chinese-characters', 'Guide: Chinese Characters', 'The building blocks of every HSK level.'),
      verbs,
      fc(1),
      fc(2),
    ];
    // business
    return [
      tones,
      blog('chinese-characters', 'Guide: Chinese Characters', 'Build a solid foundation first.'),
      verbs,
      fc(1),
      bizPhrase,
    ];
  }

  if (level === 'beginner1') {
    if (goal === 'travel') return [
      phrase('situation-1', 'Phrasebook: Greetings', 'Refresh and expand your greeting vocabulary.'),
      phrase('situation-2', 'Phrasebook: Introducing Yourself', 'Go beyond basics with richer self-introductions.'),
      verbs,
      fc(1),
      phrase('situation-4', 'What Natives Ask You', 'Common questions locals will ask — advanced phrases.', true),
    ];
    if (goal === 'hsk') return [
      fc(1),
      blog('asking-questions-chinese', 'Guide: Asking Questions in Chinese', 'Question patterns essential for HSK 2.'),
      verbs,
      fc(2),
    ];
    if (goal === 'business') return [
      fc(2),
      bizPhrase,
      verbs,
      fc(3),
    ];
    // culture / interest
    return [
      tones,
      blog('chinese-characters', 'Guide: Chinese Characters', 'Discover the stories behind the characters.'),
      verbs,
      fc(1),
    ];
  }

  if (level === 'intermediate') {
    if (goal === 'business') return [bizPhrase, fc(4), fc(5)];
    if (goal === 'hsk') return [
      fc(3),
      verbs,
      blog('asking-questions-chinese', 'Guide: Asking Questions in Chinese', 'Patterns you\'ll encounter on HSK 3–4.'),
      fc(4),
    ];
    return [
      fc(3),
      fc(4),
      { icon: '📖', title: 'Blog Articles', desc: 'Deepen your understanding with curated guides and grammar deep-dives.', href: '/blog', cta: 'Explore →' },
    ];
  }

  // advanced
  return [
    fc(5),
    fcLocked('HSK 6–9 Flashcards (Premium)'),
    { icon: '📖', title: 'Blog: Advanced Topics', desc: 'Grammar patterns, chengyu analysis, and advanced reading guides.', href: '/blog', cta: 'Explore →' },
  ];
}

export default function LearningPath() {
  const router = useRouter();
  const auth   = (useAuth() as any) ?? {};
  const { user, session } = auth;

  const [mounted,  setMounted]  = useState(false);
  const [step,     setStep]     = useState(0);
  const [answers,  setAnswers]  = useState<Partial<Answers>>({});
  const [saved,    setSaved]    = useState<Saved | null>(null);
  const [visible,  setVisible]  = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  if (!mounted) return null;

  function pick(field: keyof Answers, value: string) {
    const next = { ...answers, [field]: value } as Partial<Answers>;
    setAnswers(next);

    if (step < QUESTIONS.length - 1) {
      setVisible(false);
      setTimeout(() => { setStep(s => s + 1); setVisible(true); }, 180);
    } else {
      const full = next as Answers;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(full)); } catch {}
      setSaved(full);

      if (user && session) {
        const sb = createClient();
        sb.from('user_profiles').upsert(
          { user_id: user.id, level: full.level, goal: full.goal, daily_time: full.time },
          { onConflict: 'user_id' }
        ).then(() => {}, () => {});
      }
    }
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSaved(null);
    setStep(0);
    setAnswers({});
    setVisible(true);
  }

  // ── Plan view ──────────────────────────────────────────────────────────────
  if (saved) {
    const steps = buildSteps(saved.level, saved.goal);
    return (
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-plan-header">
            <h2 className="lp-plan-title">Your Learning Path</h2>
            <p className="lp-plan-sub">Personalized recommendations based on your answers</p>
          </div>
          <div className="lp-steps">
            {steps.map((s, i) => (
              <div key={i} className={`lp-step${s.locked ? ' lp-step-locked' : ''}`}>
                <div className="lp-step-num">{i + 1}</div>
                <div className="lp-step-icon">{s.icon}</div>
                <div className="lp-step-body">
                  <div className="lp-step-title">{s.title}</div>
                  <div className="lp-step-desc">{s.desc}</div>
                </div>
                <button
                  className={`lp-step-btn${s.locked ? ' lp-step-btn-locked' : ''}`}
                  onClick={() => router.push(s.href)}
                >
                  {s.cta}
                </button>
              </div>
            ))}
          </div>
          <button className="lp-retake" onClick={reset}>Retake quiz</button>
        </div>
      </section>
    );
  }

  // ── Quiz view ──────────────────────────────────────────────────────────────
  const q = QUESTIONS[step];

  return (
    <section className="lp-section">
      <div className="lp-inner">
        <div className="lp-intro">
          <h2 className="lp-intro-title">Get a personalized learning plan</h2>
          <p className="lp-intro-sub">Answer 3 quick questions to find your starting point.</p>
        </div>
        <div className={`lp-card${visible ? ' lp-card-in' : ''}`}>
          <div className="lp-progress">
            <div className="lp-dots">
              {QUESTIONS.map((_, i) => (
                <div key={i} className={`lp-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
              ))}
            </div>
            <span className="lp-progress-label">{step + 1} / {QUESTIONS.length}</span>
          </div>
          <h2 className="lp-q">{q.q}</h2>
          <div className="lp-options">
            {q.options.map(opt => (
              <button
                key={opt.value}
                className="lp-option"
                onClick={() => pick(q.field, opt.value)}
              >
                <span className="lp-option-emoji">{(opt as any).emoji}</span>
                <span className="lp-option-text">
                  <span className="lp-option-label">{opt.label}</span>
                  {'sub' in opt && (opt as any).sub && (
                    <span className="lp-option-sub">{(opt as any).sub}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

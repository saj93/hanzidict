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
interface Saved   extends Answers { steps: Step[]; }

const QUESTIONS = [
  {
    q: "What's your current level?",
    field: 'level' as keyof Answers,
    options: [
      { value: 'beginner0',    label: 'Complete beginner', sub: 'I know nothing'            },
      { value: 'beginner1',    label: 'Beginner',          sub: 'I know a few words/phrases' },
      { value: 'intermediate', label: 'Intermediate',      sub: 'HSK 2–4'                   },
      { value: 'advanced',     label: 'Advanced',          sub: 'HSK 5+'                    },
    ],
  },
  {
    q: "What's your main goal?",
    field: 'goal' as keyof Answers,
    options: [
      { value: 'travel',   label: 'Travel to China/Taiwan'        },
      { value: 'business', label: 'Business & professional use'   },
      { value: 'culture',  label: 'Chinese culture & entertainment'},
      { value: 'hsk',      label: 'Pass the HSK exam'             },
      { value: 'interest', label: 'General interest'              },
    ],
  },
  {
    q: 'How much time can you dedicate daily?',
    field: 'time' as keyof Answers,
    options: [
      { value: '5',  label: '5 minutes',   sub: 'Quick daily habit' },
      { value: '15', label: '15 minutes',  sub: 'Steady progress'   },
      { value: '30', label: '30 minutes+', sub: 'Fast track'        },
    ],
  },
];

function buildSteps(level: Level, goal: Goal): Step[] {
  const fc = (n: number): Step => ({
    icon: '🃏', title: `HSK ${n} Flashcards`,
    desc: `Study the HSK ${n} vocabulary set with spaced repetition.`,
    href: '/flashcards', cta: 'Study →',
  });
  const fcLocked = (label: string): Step => ({
    icon: '🔒', title: label,
    desc: 'Unlock the full advanced deck with a premium account.',
    href: '/pricing', cta: 'Unlock →', locked: true,
  });
  const blog = (slug: string, title: string, desc: string): Step => ({
    icon: '📖', title, desc, href: `/blog/${slug}`, cta: 'Read →',
  });
  const phrase = (slug: string, title: string, desc: string, locked = false): Step => ({
    icon: locked ? '🔒' : '💬', title, desc,
    href: `/phrasebook/${slug}`, cta: locked ? 'Unlock →' : 'Start →', locked,
  });
  const bizPhrase: Step = {
    icon: '💼', title: 'Business Phrasebook',
    desc: 'Professional Chinese phrases for meetings and networking — coming soon.',
    href: '/phrasebook/business', cta: 'Coming soon', locked: true,
  };

  if (level === 'beginner0') {
    if (goal === 'travel') return [
      phrase('greetings', 'Phrasebook: Greetings', 'Master basic hellos, goodbyes and pleasantries.'),
      phrase('introductions', 'Phrasebook: Introducing Yourself', "Say your name, where you're from, and more."),
      phrase('misunderstandings', "Phrasebook: When You Don't Understand", 'Essential rescue phrases for any situation.'),
      fc(1),
    ];
    if (goal === 'culture' || goal === 'interest') return [
      blog('chinese-characters', 'Guide: Chinese Characters', 'Understand how characters work before you learn them.'),
      phrase('greetings', 'Phrasebook: Greetings', 'Start speaking from day one.'),
      fc(1),
    ];
    if (goal === 'hsk') return [
      blog('chinese-characters', 'Guide: Chinese Characters', 'The building blocks of every HSK level.'),
      fc(1),
      fc(2),
    ];
    // business
    return [
      blog('chinese-characters', 'Guide: Chinese Characters', 'Build a solid foundation first.'),
      fc(1),
      bizPhrase,
    ];
  }

  if (level === 'beginner1') {
    if (goal === 'travel') return [
      phrase('greetings', 'Phrasebook: Greetings', 'Refresh and expand your greeting vocabulary.'),
      phrase('introductions', 'Phrasebook: Introducing Yourself', 'Go beyond basics with richer self-introductions.'),
      fc(1),
      phrase('natives', 'What Natives Ask You', 'Common questions locals will ask — advanced phrases.', true),
    ];
    if (goal === 'hsk') return [
      fc(1),
      fc(2),
      blog('asking-questions-chinese', 'Guide: Asking Questions in Chinese', 'Question patterns essential for HSK 2.'),
    ];
    if (goal === 'business') return [
      fc(2),
      bizPhrase,
      fc(3),
    ];
    // culture / interest
    return [
      fc(1),
      blog('chinese-characters', 'Guide: Chinese Characters', 'Discover the stories behind the characters.'),
      fc(2),
    ];
  }

  if (level === 'intermediate') {
    if (goal === 'business') return [bizPhrase, fc(4), fc(5)];
    if (goal === 'hsk') return [
      fc(3),
      fc(4),
      blog('asking-questions-chinese', 'Guide: Asking Questions in Chinese', 'Patterns you\'ll encounter on HSK 3–4.'),
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
      const steps = buildSteps(full.level, full.goal);
      const data: Saved = { ...full, steps };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
      setSaved(data);

      if (user && session) {
        const sb = createClient();
        sb.from('user_profiles').upsert(
          { user_id: user.id, level: full.level, goal: full.goal, daily_time: full.time },
          { onConflict: 'user_id' }
        ).then(() => {}).catch(() => {});
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
    return (
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-plan-header">
            <h2 className="lp-plan-title">Your Learning Path</h2>
            <p className="lp-plan-sub">Personalized recommendations based on your answers</p>
          </div>
          <div className="lp-steps">
            {saved.steps.map((s, i) => (
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
                <span className="lp-option-label">{opt.label}</span>
                {'sub' in opt && (opt as any).sub && (
                  <span className="lp-option-sub">{(opt as any).sub}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

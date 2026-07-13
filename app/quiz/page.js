'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Questions ────────────────────────────────────────────────────────────────

const Q1 = {
  id: 'level',
  q: "What's your current level?",
  options: [
    { value: 'beginner0', label: 'Complete beginner', sub: 'I know nothing' },
    { value: 'beginner1', label: 'Beginner', sub: 'I know a few words or phrases' },
    { value: 'intermediate', label: 'Intermediate', sub: 'HSK 2–4' },
    { value: 'advanced', label: 'Advanced', sub: 'HSK 5+' },
  ],
};

const Q2 = {
  id: 'reason',
  q: 'Why do you want to learn Chinese?',
  options: [
    { value: 'travel', label: 'Travel to China or Taiwan' },
    { value: 'work', label: 'Work or business' },
    { value: 'partner', label: 'My partner or family speaks Chinese' },
    { value: 'culture', label: 'Chinese culture (film, music, food)' },
    { value: 'personal', label: 'Personal challenge / general interest' },
  ],
};

const Q3_BY_REASON = {
  travel: {
    id: 'q3',
    q: 'Are you planning a trip soon, or thinking long-term?',
    options: [
      { value: 'soon', label: 'Soon (within 6 months)' },
      { value: 'longterm', label: 'Long-term' },
    ],
  },
  work: {
    id: 'q3',
    q: 'Do you need spoken Chinese, written Chinese, or both?',
    options: [
      { value: 'spoken', label: 'Spoken' },
      { value: 'written', label: 'Written' },
      { value: 'both', label: 'Both' },
    ],
  },
  partner: {
    id: 'q3',
    q: 'What matters most to you?',
    options: [
      { value: 'understand', label: 'Understanding them better in conversations' },
      { value: 'surprise', label: 'Surprising them with my Chinese' },
      { value: 'both', label: 'Both' },
    ],
  },
};

const Q4 = {
  id: 'main_goal',
  q: "What's your main goal?",
  options: [
    { value: 'conversations', label: 'Have basic everyday conversations' },
    { value: 'reading', label: 'Read and understand Chinese text' },
    { value: 'hsk_exam', label: 'Pass an HSK exam' },
    { value: 'fluent', label: 'Become fully fluent' },
  ],
};

const Q5 = {
  id: 'blocker',
  q: "What's stopped you before?",
  options: [
    { value: 'never_tried', label: "I've never tried to learn Chinese" },
    { value: 'too_hard', label: 'I tried but found it too hard' },
    { value: 'tried_apps', label: "I tried apps like Duolingo but didn't stick with it" },
    { value: 'plateau', label: "I've been learning but hit a plateau" },
  ],
};

const Q6 = {
  id: 'time',
  q: 'How much time can you spend daily?',
  options: [
    { value: '5', label: '5 minutes' },
    { value: '15', label: '10–15 minutes' },
    { value: '30', label: '30 minutes or more' },
  ],
};

const Q7 = {
  id: 'style',
  q: 'How do you learn best?',
  options: [
    { value: 'phrases', label: 'Seeing words in real phrases and sentences' },
    { value: 'lists', label: 'Systematic vocabulary lists' },
    { value: 'grammar', label: 'Grammar explanations and structure' },
    { value: 'mixed', label: 'A mix of everything' },
  ],
};

function getQuestions(answers) {
  const qs = [Q1, Q2];
  const q3 = Q3_BY_REASON[answers.reason];
  if (q3) qs.push(q3);
  qs.push(Q4, Q5, Q6, Q7);
  return qs;
}

// ── Plan builder ─────────────────────────────────────────────────────────────

const STEPS = {
  tones:       { icon: '🎵', title: 'Start with Mandarin Tones', desc: 'The essential foundation — hear all four tones with audio examples and minimal pairs.', href: '/blog/tones', cta: 'Read guide →' },
  characters:  { icon: '🀄', title: 'Guide: How Chinese Characters Work', desc: 'Understand the logic behind characters before you start memorising them.', href: '/blog/chinese-characters', cta: 'Read guide →' },
  hsk1:        { icon: '🃏', title: 'HSK 1 Flashcards', desc: 'Learn the 150 most essential Chinese words with spaced repetition.', href: '/hsk/1', cta: 'Start studying →' },
  hsk2:        { icon: '🃏', title: 'HSK 2 Flashcards', desc: '300 words covering everyday conversations and situations.', href: '/hsk/2', cta: 'Start studying →' },
  hsk3:        { icon: '🃏', title: 'HSK 3 Flashcards', desc: 'Expand to 600 words and unlock real conversational ability.', href: '/hsk/3', cta: 'Start studying →' },
  hsk4:        { icon: '🃏', title: 'HSK 4 Flashcards', desc: '1,200 words — the threshold for real fluency in most everyday topics.', href: '/hsk/4', cta: 'Start studying →' },
  hsk5:        { icon: '🃏', title: 'HSK 5–7 Flashcards', desc: 'Advanced vocabulary for professional and near-native communication.', href: '/hsk/5', cta: 'Start studying →' },
  verbs:       { icon: '⚡', title: '100 Most Common Verbs', desc: 'The highest-frequency action words in Chinese — essential for building any sentence.', href: '/verbs', cta: 'Explore verbs →' },
  greetings:   { icon: '👋', title: 'Phrasebook: Greetings & Politeness', desc: "Master hellos, goodbyes, and everyday pleasantries — the words you'll use most.", href: '/phrasebook/situation-1', cta: 'Open phrasebook →' },
  introducing: { icon: '🙋', title: 'Phrasebook: Introducing Yourself', desc: "Say your name, where you're from, and what you do — your first real conversation.", href: '/phrasebook/situation-2', cta: 'Open phrasebook →' },
  restaurant:  { icon: '🍜', title: 'Phrasebook: At the Restaurant', desc: 'Order food, ask about dishes, and handle a meal in Chinese with confidence.', href: '/phrasebook/situation-6', cta: 'Open phrasebook →' },
  travel_ph:   { icon: '✈️', title: 'Phrasebook: Travel', desc: 'Practical Chinese for airports, trains, hotels, and getting around.', href: '/phrasebook/situation-8', cta: 'Open phrasebook →' },
  phrasebook:  { icon: '💬', title: 'Full Phrasebook', desc: 'Hundreds of real-world phrases organized by situation — greetings to advanced topics.', href: '/phrasebook', cta: 'Open phrasebook →' },
  learn:       { icon: '📚', title: 'Structured Learning Path', desc: 'A step-by-step curriculum from HSK 1 through advanced levels, with quizzes.', href: '/learn', cta: 'Start learning →' },
  chengyu:     { icon: '📜', title: 'Chinese Idioms (成语)', desc: 'Four-character idioms — the cultural heart of Chinese expression.', href: '/chengyu', cta: 'Browse idioms →' },
  blog:        { icon: '📖', title: 'Language Guides & Articles', desc: 'Deep-dives on tones, grammar patterns, characters, and more.', href: '/blog', cta: 'Explore blog →' },
};

function buildPlan(answers) {
  const { level, reason, main_goal, blocker, style } = answers;
  const s = STEPS;

  const titleMap = {
    travel:  'Your travel Chinese plan is ready',
    work:    'Your professional Chinese plan is ready',
    partner: 'Your plan to connect with your loved ones is ready',
    culture: 'Your cultural immersion plan is ready',
    personal: 'Your personalized Chinese plan is ready',
  };
  const title = titleMap[reason] ?? 'Your Chinese learning plan is ready';

  const blockerMap = {
    never_tried: "You're starting fresh — and that's a great position to be in. We'll build a solid foundation from day one.",
    too_hard:    "Chinese is learnable when you break it down the right way. We've structured it to build naturally.",
    tried_apps:  "HanziDict is built for depth, not streaks. No gamification — just real language that sticks.",
    plateau:     "You've already come a long way. Let's break through to the next level with targeted content.",
  };
  const subtitle = blockerMap[blocker] ?? "Here's what we recommend based on your answers.";

  let steps;
  if (level === 'beginner0') {
    if (reason === 'travel')   steps = [s.tones, s.greetings, s.travel_ph, s.hsk1];
    else if (reason === 'work')    steps = [s.tones, s.characters, s.hsk1, s.hsk2];
    else if (reason === 'partner') steps = [s.tones, s.greetings, s.introducing, s.hsk1];
    else                           steps = [s.tones, s.characters, s.verbs, s.hsk1];
  } else if (level === 'beginner1') {
    if (reason === 'travel')       steps = [s.greetings, s.travel_ph, s.verbs, s.hsk1];
    else if (reason === 'work')    steps = [s.hsk2, s.verbs, s.hsk3, s.phrasebook];
    else if (reason === 'partner') steps = [s.greetings, s.introducing, s.verbs, s.hsk1];
    else if (reason === 'culture') steps = [s.characters, s.verbs, s.hsk1, s.chengyu];
    else                           steps = [s.hsk1, s.verbs, s.learn, s.blog];
  } else if (level === 'intermediate') {
    if (reason === 'travel')       steps = [s.hsk3, s.travel_ph, s.restaurant, s.phrasebook];
    else if (reason === 'work')    steps = [s.hsk4, s.verbs, s.phrasebook, s.learn];
    else if (reason === 'culture') steps = [s.hsk3, s.chengyu, s.blog, s.learn];
    else                           steps = [s.hsk3, s.hsk4, s.verbs, s.learn];
  } else {
    steps = [s.hsk5, s.chengyu, s.learn, s.blog];
  }

  steps = [...steps];

  if (main_goal === 'hsk_exam' && !steps.includes(s.learn)) steps[3] = s.learn;
  if (main_goal === 'reading' && !steps.includes(s.characters)) steps[0] = s.characters;
  if (main_goal === 'conversations' && !steps.some(x => x === s.phrasebook || x === s.greetings)) steps[3] = s.phrasebook;
  if (style === 'grammar' && !steps.includes(s.blog)) steps[3] = s.blog;
  if (style === 'phrases' && !steps.some(x => x === s.phrasebook || x === s.greetings || x === s.travel_ph)) steps[3] = s.phrasebook;

  return { title, subtitle, steps: steps.slice(0, 4) };
}

// ── Component ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hanzidict-quiz-result';

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visible, setVisible] = useState(true);
  const [done, setDone] = useState(false);
  const [plan, setPlan] = useState(null);

  const questions = getQuestions(answers);
  const q = questions[step];
  const progressPct = Math.round((step / 7) * 100);

  function pick(id, value) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    const nextQuestions = getQuestions(next);
    setVisible(false);

    if (step < nextQuestions.length - 1) {
      setTimeout(() => { setStep(s => s + 1); setVisible(true); }, 200);
    } else {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      setTimeout(() => { setPlan(buildPlan(next)); setDone(true); }, 200);
    }
  }

  if (done && plan) {
    return (
      <div className="quiz-root">
        <div className="quiz-progress-track"><div className="quiz-progress-fill" style={{ width: '100%' }} /></div>
        <header className="quiz-header">
          <button className="quiz-wordmark" onClick={() => router.push('/')}>
            <span className="logo-mark">汉</span>HanziDict
          </button>
        </header>
        <main className="quiz-results">
          <div className="quiz-results-inner">
            <div className="quiz-check">✓</div>
            <h1 className="quiz-plan-title">{plan.title}</h1>
            <p className="quiz-plan-subtitle">{plan.subtitle}</p>
            <div className="quiz-plan-steps">
              {plan.steps.map((s, i) => (
                <button key={i} className="quiz-plan-step" onClick={() => router.push(s.href)}>
                  <span className="quiz-plan-step-icon">{s.icon}</span>
                  <span className="quiz-plan-step-body">
                    <span className="quiz-plan-step-title">{s.title}</span>
                    <span className="quiz-plan-step-desc">{s.desc}</span>
                  </span>
                  <span className="quiz-plan-step-cta">{s.cta}</span>
                </button>
              ))}
            </div>
            <div className="quiz-ctas">
              <button className="quiz-cta-primary" onClick={() => router.push('/signup')}>Start for free →</button>
              <button className="quiz-cta-secondary" onClick={() => router.push('/')}>Explore HanziDict →</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="quiz-root">
      <div className="quiz-progress-track"><div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} /></div>
      <header className="quiz-header">
        <button className="quiz-wordmark" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
      </header>
      <main className="quiz-body">
        <div className={`quiz-card${visible ? ' quiz-card-visible' : ''}`}>
          <p className="quiz-step-label">Question {step + 1} of {questions.length}</p>
          <h1 className="quiz-question">{q.q}</h1>
          <div className="quiz-options">
            {q.options.map(opt => (
              <button key={opt.value} className="quiz-option" onClick={() => pick(q.id, opt.value)}>
                <span className="quiz-option-label">{opt.label}</span>
                {opt.sub && <span className="quiz-option-sub">{opt.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

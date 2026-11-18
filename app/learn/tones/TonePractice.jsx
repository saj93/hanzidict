'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { drawTone, getToneVariants, toneAccuracy, playToneSequence, TONES } from '../../../lib/tonePractice';
import './tones.css';

function prepareAudio(pool, clip) {
  if (!pool.has(clip.audio)) {
    const audio = new Audio(clip.audio);
    audio.preload = 'auto';
    audio.load();
    pool.set(clip.audio, audio);
  }
  return pool.get(clip.audio);
}

export default function TonePractice() {
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [heard, setHeard] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const audioRef = useRef(null);
  const audioPool = useRef(new Map());
  const upcoming = useRef(null);
  const controllerRef = useRef(null);
  const nextTimer = useRef(null);
  const locked = useRef(false);
  const handlers = useRef({});

  useEffect(() => {
    const pool = audioPool.current;
    const frame = requestAnimationFrame(() => {
      const first = drawTone();
      upcoming.current = drawTone(first.audio);
      // Keep one playback element unlocked by the first user gesture on iOS.
      audioRef.current = new Audio(first.audio);
      audioRef.current.preload = 'auto';
      audioRef.current.load();
      prepareAudio(pool, upcoming.current);
      setQuestion(first);
    });
    const keydown = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) handlers.current.choose?.(Number(e.key));
      else if (e.code === 'Space' && (e.target.tagName !== 'BUTTON' || e.target.disabled)) { e.preventDefault(); handlers.current.play?.(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame); clearTimeout(nextTimer.current);
      window.removeEventListener('keydown', keydown); controllerRef.current?.abort();
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      audioRef.current = null;
      for (const audio of pool.values()) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      pool.clear();
    };
  }, []);

  function stop() { controllerRef.current?.abort(); audioRef.current?.pause(); setPlaying(false); }
  async function play(clip = question, counts = true) {
    if (!clip || (counts && locked.current)) return;
    stop();
    const controller = new AbortController(); controllerRef.current = controller;
    audioRef.current ??= new Audio();
    setPlaying(true); setError('');
    try {
      await playToneSequence(audioRef.current, [clip], { signal: controller.signal });
      if (!controller.signal.aborted && counts) setHeard(true);
    } catch (e) { if (!controller.signal.aborted && e.name !== 'AbortError') setError(e.message); }
    finally { if (!controller.signal.aborted) setPlaying(false); }
  }
  function choose(tone) {
    if (!question || locked.current || !heard || playing) return;
    locked.current = true;
    const right = question.tone === tone;
    setFeedback({ selected: tone, correct: right, question });
    setTransitioning(true);
    setComparing(false);
    if (right) setCorrect(n => n + 1); else setWrong(n => n + 1);
    nextTimer.current = setTimeout(() => advance(), 450);
  }
  function advance(reset = false) {
    clearTimeout(nextTimer.current);
    stop(); locked.current = false;
    const next = upcoming.current ?? drawTone(question?.audio);
    upcoming.current = drawTone(next.audio);
    prepareAudio(audioPool.current, next);
    prepareAudio(audioPool.current, upcoming.current);
    setQuestion(next); setHeard(false); setError(''); setTransitioning(false);
    if (reset) { setCorrect(0); setWrong(0); setFeedback(null); setComparing(false); }
    else play(next);
  }
  useEffect(() => { handlers.current = { play: () => play(), choose }; });
  const accuracy = toneAccuracy(correct, wrong);

  return <main>
    <Nav hideScript />
    <section className="tone-page" aria-label="Tone listening practice">
      <Link href="/learn" className="tone-back">← Explore freely</Link>
      <header className="tone-heading"><h1>Tone practice</h1><button className="tone-text-button" onClick={() => advance(true)}>Start over</button></header>
      <p className="tone-subtitle">Listen to one syllable. Choose its tone. Keep practising.</p>
      <div className="tone-answers">{TONES.map(t => {
        const right = transitioning && question.tone === t.number;
        const incorrect = transitioning && feedback.selected === t.number && !right;
        return <button key={t.number} className={`${right ? 'is-correct' : ''} ${incorrect ? 'is-wrong' : ''}`} disabled={!heard || playing || transitioning} onClick={() => choose(t.number)} aria-label={`Tone ${t.number}: ${t.label}`} title={t.description}>
          <svg viewBox="0 0 64 32" width="48" height="26" aria-hidden="true"><path d={t.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{['1st', '2nd', '3rd', '4th'][t.number - 1]} tone</span>
        </button>;
      })}</div>
      <div className="tone-player">
        <button className="tone-play" disabled={!question || playing || transitioning} aria-busy={playing} aria-label="Play audio" onClick={() => play()}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4L21 12L7 20Z" fill="currentColor" /></svg>Play</button>
      </div>
      <p className="tone-hint">{transitioning ? 'Next sound starts automatically…' : !heard ? 'Listen to the audio before choosing a tone.' : '1–4 to answer · Space to play again'}</p>
      <div className="tone-stats" aria-label="Practice score" aria-live="polite">
        <span className="tone-correct">Correct: <b>{correct}</b></span><span className="tone-wrong">Wrong: <b>{wrong}</b></span><span>Accuracy: <b>{accuracy === null ? '—' : `${accuracy}%`}</b></span>
      </div>
      <div className="tone-result-area">
        {error && <p role="alert" className="tone-error">{error} Your score has not changed.</p>}
        {feedback ? <>
          <div className="tone-feedback" role="status"><strong className={feedback.correct ? 'tone-correct' : 'tone-wrong'}>{feedback.correct ? '✓ Correct' : `Not quite — tone ${feedback.question.tone}`}</strong><div className="tone-word"><span>{feedback.question.pinyin}</span><Link href={`/word/${encodeURIComponent(feedback.question.hanzi)}`} lang="zh">{feedback.question.hanzi}</Link><span className="tone-gloss">{feedback.question.gloss}</span></div></div>
          <div className="tone-actions"><button className="tone-text-button" aria-expanded={comparing} onClick={() => setComparing(!comparing)}>Compare tones</button></div>
          {comparing && <div className="tone-compare" aria-label="Compare the four tones">{getToneVariants(feedback.question.syllable).map(c => <button key={c.tone} disabled={playing || transitioning} onClick={() => play(c, false)} aria-label={`Hear ${c.pinyin}, tone ${c.tone}`}>{c.pinyin} <span aria-hidden="true">▷</span></button>)}</div>}
        </> : !error && <p className="tone-waiting">The character, pinyin and meaning appear after your answer.</p>}
      </div>
      <p className="tone-footnote">Isolated dictionary tones · Synthetic Mandarin audio</p>
    </section>
  </main>;
}

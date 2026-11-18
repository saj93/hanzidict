'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { createToneSession, isToneAnswerCorrect, playToneSequence, TONES } from '../../../lib/tonePractice';
import './tones.css';

function Contour({ tone }) {
  return <svg viewBox="0 0 64 32" width="64" height="32" aria-hidden="true"><path d={tone.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function TonePractice() {
  const [pairs, setPairs] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tones, setTones] = useState([1, 2, 3, 4]);
  const [length, setLength] = useState(10);
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [slot, setSlot] = useState(0);
  const [heard, setHeard] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState(false);
  const audioRef = useRef(null);
  const controllerRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    const keydown = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); handlersRef.current.play?.(); }
      else if (/^[1-4]$/.test(e.key)) handlersRef.current.choose?.(Number(e.key));
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') handlersRef.current.next?.();
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); controllerRef.current?.abort(); audioRef.current?.pause(); };
  }, []);

  const question = session?.[index];
  const feedback = answers[index];
  const finished = session && index >= session.length;
  const correct = answers.filter(a => a.correct).length;

  function stop() { controllerRef.current?.abort(); audioRef.current?.pause(); setPlaying(false); }
  function resetQuestion() { stop(); setSelected([]); setSlot(0); setHeard(false); setError(''); setComparing(false); }
  function start(nextPairs = pairs) {
    resetQuestion();
    setSession(createToneSession({ tones, length, pairs: nextPairs }));
    setIndex(0); setAnswers([]);
  }
  function changeMode(value) { resetQuestion(); setPairs(value); setSession(null); setAnswers([]); setIndex(0); }

  async function play(clips = question?.clips, slow = false, counts = true) {
    if (!clips?.length) return;
    stop();
    const controller = new AbortController();
    controllerRef.current = controller;
    audioRef.current ??= new Audio();
    setPlaying(true); setError('');
    try {
      await playToneSequence(audioRef.current, clips, { rate: slow ? 0.75 : 1, signal: controller.signal });
      if (!controller.signal.aborted && counts) setHeard(true);
    } catch (e) { if (!controller.signal.aborted && e.name !== 'AbortError') setError(e.message); }
    finally { if (!controller.signal.aborted) setPlaying(false); }
  }

  function choose(tone) {
    if (!question || feedback || !heard || playing) return;
    const next = [...selected]; next[slot] = tone; setSelected(next);
    if (question.clips.every((_, i) => next[i])) {
      setAnswers([...answers, { correct: isToneAnswerCorrect(question, next), skipped: false, selected: next }]);
    } else setSlot(1);
  }
  function next() { if (feedback) { resetQuestion(); setIndex(index + 1); } }
  function skip() {
    if (!question || feedback) return;
    setAnswers([...answers, { correct: false, skipped: true, selected: [] }]);
    resetQuestion(); setIndex(index + 1);
  }
  useEffect(() => { handlersRef.current = { play: () => play(), choose, next }; });

  return <main>
    <Nav hideScript />
    <div className="tone-page">
      <Link href="/learn" className="tone-back">← Explore freely</Link>
      <h1>Tone practice</h1>
      <p className="tone-subtitle">Train your ear, one syllable at a time.</p>
      <div className="tone-toolbar">
        <div role="group" aria-label="Practice mode">
          <button aria-pressed={!pairs} onClick={() => changeMode(false)}>Single syllables</button>
          <button aria-pressed={pairs} onClick={() => changeMode(true)}>Tone pairs</button>
        </div>
        <button aria-expanded={settings} onClick={() => setSettings(!settings)}>Settings</button>
      </div>
      {settings && <fieldset className="tone-settings"><legend>Next session</legend>
        <div className="tone-checks">{TONES.map(t => <label key={t.number}><input type="checkbox" checked={tones.includes(t.number)} disabled={tones.length === 1 && tones.includes(t.number)} onChange={() => setTones(tones.includes(t.number) ? tones.filter(n => n !== t.number) : [...tones, t.number].sort())} />Tone {t.number}</label>)}</div>
        <label>Questions <select value={length} onChange={e => setLength(Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option></select></label>
        {session && <button className="tone-secondary" onClick={() => { start(); setSettings(false); }}>Start new session</button>}
      </fieldset>}
      {!session ? <section className="tone-intro">
        <span className="tone-eyebrow">LISTEN, THEN CHOOSE</span>
        <h2>Get to know the four tones.</h2>
        <p>Listen to a syllable and identify its tone. The answer appears only after you choose.</p>
        <div className="tone-reference">{TONES.map(t => <div key={t.number}><Contour tone={t} /><span>{t.number} · {t.label}</span></div>)}</div>
        <button className="tone-primary" onClick={() => start()}>Start practice →</button>
      </section> : finished ? <section className="tone-intro" aria-live="polite">
        <span className="tone-eyebrow">SESSION COMPLETE</span><h2>{correct} / {session.length} correct</h2>
        <p>{answers.filter(a => a.skipped).length} skipped. Practice again to hear a new selection.</p>
        <button className="tone-primary" onClick={() => start()}>Practice again →</button>
      </section> : <section className="tone-exercise">
        <div className="tone-progress-label"><span>Question {index + 1} of {session.length}</span><span>{answers.length ? `${correct} / ${answers.length} correct` : '0 correct'}</span></div>
        <progress value={answers.length} max={session.length} aria-label="Session progress" />
        <span className="tone-eyebrow">LISTEN, THEN CHOOSE</span>
        <div className="tone-player"><button className="tone-play" aria-label={playing ? 'Playing audio' : 'Play audio'} aria-busy={playing} disabled={playing} onClick={() => play()}><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4L21 12L7 20Z" fill="currentColor" /></svg></button>
          <button onClick={() => play()} disabled={playing}>Play again</button><button onClick={() => play(undefined, true)} disabled={playing}>Slower</button></div>
        <div className="tone-syllable" aria-label="Syllable">{question.clips.map(c => c.syllable).join(' · ')}</div>
        <p className="tone-prompt">{pairs ? 'Which two tones did you hear?' : 'Which tone did you hear?'}</p>
        {pairs && <div className="tone-slots" role="group" aria-label="Answer position">{question.clips.map((_, i) => <button key={i} aria-pressed={slot === i} disabled={!!feedback} onClick={() => setSlot(i)}>{i === 0 ? 'First' : 'Second'} syllable: {selected[i] || '—'}</button>)}</div>}
        <div className="tone-answers">{TONES.map(t => {
          const right = feedback && question.clips[slot].tone === t.number;
          const wrong = feedback && selected[slot] === t.number && !right;
          return <button key={t.number} className={`${right ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`} disabled={!heard || playing || !!feedback} onClick={() => choose(t.number)} aria-label={`Tone ${t.number}: ${t.label}`}><Contour tone={t} /><span>{t.number} · {t.label}</span></button>;
        })}</div>
        <p className="tone-hint">{!heard ? 'Play the audio before choosing.' : 'Use keys 1–4 · Space to replay'}</p>
        {error && <p role="alert" className="tone-error">{error} Your score has not changed.</p>}
        {feedback && <div className={`tone-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`} role="status">
          <strong>{feedback.correct ? '✓ Correct' : 'Not quite — listen again'}</strong>
          <div className="tone-reveal">{question.clips.map((c, i) => <div key={i}><span>{c.pinyin}</span> <span lang="zh">{c.hanzi}</span><small>{c.gloss} · Tone {c.tone}</small></div>)}</div>
          <p>{question.clips.map(c => TONES[c.tone - 1].description).join(' · ')}</p>
          <div className="tone-feedback-actions"><button className="tone-secondary" aria-expanded={comparing} onClick={() => setComparing(!comparing)}>Compare tones</button><button className="tone-primary" onClick={next}>{index + 1 === session.length ? 'See results' : 'Next →'}</button></div>
          {comparing && question.clips.map((c, i) => <div className="tone-compare" key={i} aria-label={`Compare syllable ${i + 1}`}>{TONES.map(t => <button key={t.number} disabled={playing} onClick={() => play([{ audio: `/audio/tones/${c.syllable}${t.number}.mp3` }], false, false)}>{c.syllable}{t.number} ▷</button>)}</div>)}
        </div>}
        {!feedback && <div className="tone-skip"><button onClick={skip}>Skip</button></div>}
      </section>}
      <p className="tone-footnote">{pairs ? 'Pairs use two separately spoken syllables: identify their dictionary tones, not connected-speech tone changes.' : 'Practice the four dictionary tones in isolation. The third tone changes in connected speech.'} Audio: synthetic Mandarin voice, prepared for this exercise.</p>
    </div>
    <Footer />
  </main>;
}

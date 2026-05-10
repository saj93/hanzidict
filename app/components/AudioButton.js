'use client';
import { useState } from 'react';

const audioCache = new Map();

async function getAudioUrl(text) {
  if (audioCache.has(text)) return audioCache.get(text);
  const response = await fetch('/api/tts?text=' + encodeURIComponent(text));
  if (!response.ok) throw new Error('TTS failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  audioCache.set(text, url);
  return url;
}

const SpeakerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="spin-icon">
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
    <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

export default function AudioButton({ text }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  async function play() {
    if (loading || playing || !text) return;
    setLoading(true);
    try {
      const url = await getAudioUrl(text);
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      setLoading(false);
      setPlaying(true);
      await audio.play();
    } catch {
      setLoading(false);
      setPlaying(false);
    }
  }

  return (
    <button
      className={`speak-btn${loading ? ' loading' : playing ? ' speaking' : ''}`}
      onClick={play}
      disabled={loading}
      title="Hear pronunciation"
      aria-label="Hear pronunciation"
    >
      {loading ? <SpinnerIcon /> : <SpeakerIcon />}
    </button>
  );
}

'use client';
import { useState, useEffect } from 'react';

const SpeakerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
  </svg>
);

const SpeakingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);

const CANTONESE = ['hk', 'yue', 'cantonese', 'sin-ji', 'sinji'];
const MANDARIN_LANGS = ['zh-cn', 'zh_cn', 'zh-tw', 'zh_tw', 'zh-sg', 'zh-hans', 'zh-hant'];

function isCantonese(v) {
  const lang = v.lang.toLowerCase();
  const name = v.name.toLowerCase();
  return CANTONESE.some(c => lang.includes(c) || name.includes(c));
}

// Preferred voices by name — quality Mandarin voices on macOS/iOS
const PREFERRED = ['tingting', 'meijia', 'mei-jia'];

function pickVoice(voices) {
  return (
    voices.find(v => PREFERRED.includes(v.name.toLowerCase())) ||
    voices.find(v => v.lang === 'zh-CN' && !isCantonese(v)) ||
    voices.find(v => MANDARIN_LANGS.includes(v.lang.toLowerCase()) && !isCantonese(v)) ||
    voices.find(v => v.lang.toLowerCase().startsWith('zh') && !isCantonese(v)) ||
    null
  );
}

export default function AudioButton({ text }) {
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    function loadVoices() {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  function speak() {
    if (!window.speechSynthesis || !text || playing) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;

    const voice = pickVoice(voices);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setPlaying(true);
    utterance.onend   = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    window.speechSynthesis.speak(utterance);
  }

  if (!supported) return null;

  return (
    <button
      className={`speak-btn${playing ? ' speaking' : ''}`}
      onClick={speak}
      title="Hear pronunciation"
      aria-label="Hear pronunciation"
    >
      {playing ? <SpeakingIcon /> : <SpeakerIcon />}
    </button>
  );
}

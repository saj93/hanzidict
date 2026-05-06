'use client';
import { useState, useEffect } from 'react';

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'zh-CN') ||
    voices.find(v => v.lang.startsWith('zh')) ||
    null
  );
}

export default function SpeakButton({ text }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  if (!supported) return null;

  function speak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.85;

    // Voices may not be loaded yet — try immediately, retry after voiceschanged
    const voice = pickVoice();
    if (voice) {
      utter.voice = voice;
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        const v = pickVoice();
        if (v) utter.voice = v;
      }, { once: true });
    }

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  return (
    <button
      className={`speak-btn${speaking ? ' speaking' : ''}`}
      onClick={speak}
      title="Hear pronunciation"
      aria-label="Hear pronunciation"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
    </button>
  );
}

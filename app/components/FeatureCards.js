'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Normalized [0-1] stroke paths for 人
const REN_STROKES = [
  [[0.50,0.12],[0.43,0.22],[0.35,0.34],[0.26,0.47],[0.17,0.60],[0.11,0.72],[0.08,0.83]],
  [[0.47,0.24],[0.53,0.35],[0.60,0.46],[0.68,0.57],[0.76,0.65],[0.84,0.73],[0.92,0.80]],
];

const RADICALS = ['一','人','口','手','水','火','木','山'];

// ── Card 1: handwriting recognition ─────────────────────────────────────────

function DrawPreviewCard({ onTry }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    function fgColor() {
      return document.documentElement.classList.contains('dark') ? '#f0ede6' : '#1a1916';
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function loop() {
      while (!cancelled) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2.5, w / 50);

        for (let si = 0; si < REN_STROKES.length; si++) {
          const stroke = REN_STROKES[si];
          for (let i = 1; i < stroke.length; i++) {
            if (cancelled) return;
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = fgColor();

            for (let s = 0; s < si; s++) {
              const pts = REN_STROKES[s];
              ctx.beginPath();
              ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
              for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0] * w, pts[j][1] * h);
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.moveTo(stroke[0][0] * w, stroke[0][1] * h);
            for (let j = 1; j <= i; j++) ctx.lineTo(stroke[j][0] * w, stroke[j][1] * h);
            ctx.stroke();

            // Green cursor dot at stroke tip
            ctx.fillStyle = '#1D9E75';
            ctx.beginPath();
            ctx.arc(stroke[i][0] * w, stroke[i][1] * h, 4, 0, Math.PI * 2);
            ctx.fill();

            await sleep(42);
          }
          await sleep(220);
        }

        await sleep(1600);
        ctx.clearRect(0, 0, w, h);
        await sleep(600);
      }
    }

    loop();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="feat-v2">
      <div className="feat-preview feat-preview-draw">
        <div className="feat-draw-lines" />
        <canvas ref={canvasRef} width={140} height={140} className="feat-draw-canvas" />
        <div className="feat-preview-label">人</div>
      </div>
      <div className="feat-v2-body">
        <div className="feat-v2-title">Handwriting recognition</div>
        <div className="feat-v2-desc">Draw any character directly in your browser — HanziLookup identifies it instantly, no input method needed.</div>
        <button className="feat-try-btn" onClick={onTry}>Try it →</button>
      </div>
    </div>
  );
}

// ── Card 2: stroke order animation ──────────────────────────────────────────

function StrokePreviewCard({ onTry }) {
  const idRef = useRef('feat-hw-' + Math.random().toString(36).slice(2));

  useEffect(() => {
    let cancelled = false;
    let writer = null;

    function startLoop() {
      if (cancelled || !writer) return;
      writer.animateCharacter({
        onComplete: () => {
          if (cancelled) return;
          setTimeout(() => {
            if (cancelled || !writer) return;
            writer.hideCharacter();
            setTimeout(() => {
              if (!cancelled) startLoop();
            }, 500);
          }, 1400);
        },
      });
    }

    function init() {
      if (cancelled || !window.HanziWriter) return;
      const el = document.getElementById(idRef.current);
      if (!el || writer) return;
      const size = Math.min(el.offsetWidth || 130, 130);
      const isDark = document.documentElement.classList.contains('dark');
      writer = window.HanziWriter.create(idRef.current, '大', {
        width: size, height: size,
        padding: Math.floor(size * 0.1),
        showOutline: true,
        strokeColor: '#1D9E75',
        outlineColor: isDark ? '#3a3835' : '#ddd9d0',
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200,
      });
      startLoop();
    }

    if (window.HanziWriter) {
      init();
    } else {
      const existing = document.querySelector('script[src*="hanzi-writer"]');
      if (existing) {
        existing.addEventListener('load', init);
      } else {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
        s.onload = init;
        document.head.appendChild(s);
      }
    }

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="feat-v2">
      <div className="feat-preview feat-preview-stroke">
        <div id={idRef.current} className="feat-hw-mount" />
      </div>
      <div className="feat-v2-body">
        <div className="feat-v2-title">Stroke order animation</div>
        <div className="feat-v2-desc">Watch every character drawn stroke by stroke with HanziWriter, then test yourself in quiz mode.</div>
        <button className="feat-try-btn" onClick={onTry}>Try it →</button>
      </div>
    </div>
  );
}

// ── Card 3: radical search ───────────────────────────────────────────────────

function RadicalPreviewCard({ onTry }) {
  return (
    <div className="feat-v2">
      <div className="feat-preview feat-preview-radical">
        <div className="feat-radical-grid">
          {RADICALS.map(r => (
            <div key={r} className="feat-radical-tile">{r}</div>
          ))}
        </div>
      </div>
      <div className="feat-v2-body">
        <div className="feat-v2-title">Radical search</div>
        <div className="feat-v2-desc">Browse characters by their radical components, just like a traditional printed dictionary.</div>
        <button className="feat-try-btn" onClick={onTry}>Try it →</button>
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function FeatureCards({ onTryDraw, onTryRadical }) {
  const router = useRouter();

  function tryStroke() {
    router.push('/word/%E5%A4%A7'); // 大
  }

  return (
    <div className="features-v2">
      <DrawPreviewCard onTry={onTryDraw} />
      <StrokePreviewCard onTry={tryStroke} />
      <RadicalPreviewCard onTry={onTryRadical} />
    </div>
  );
}

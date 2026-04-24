'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function DrawCanvas() {
  const router = useRouter();
  const [hlReady, setHlReady] = useState(false);
  const [drawStrokes, setDrawStrokes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const canvasRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const drawStrokesRef = useRef([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.HanziLookup?.data?.mmah) { setHlReady(true); return; }
    if (window._hlLoading) return;
    window._hlLoading = true;
    const s = document.createElement('script');
    s.src = '/hanzilookup.min.js';
    s.onload = () => {
      window.HanziLookup.init('mmah', '/mmah.json', ok => {
        window._hlLoading = false;
        if (ok) setHlReady(true);
      });
    };
    document.head.appendChild(s);
  }, []);

  // Attach pointer listeners with { passive: false } so preventDefault() works on mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
      ];
    }

    function onDown(e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = getPos(e);
      activeStrokeRef.current = [[x, y]];
      const isDark = document.documentElement.classList.contains('dark');
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = isDark ? '#f0ede6' : '#1a1916';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function onMove(e) {
      e.preventDefault();
      if (!activeStrokeRef.current) return;
      const [x, y] = getPos(e);
      activeStrokeRef.current.push([x, y]);
      const ctx = canvas.getContext('2d');
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function onUp(e) {
      e.preventDefault();
      if (!activeStrokeRef.current) return;
      const newStrokes = [...drawStrokesRef.current, activeStrokeRef.current];
      drawStrokesRef.current = newStrokes;
      activeStrokeRef.current = null;
      setDrawStrokes([...newStrokes]);
      runLookup(newStrokes, canvas);
    }

    function onCancel(e) {
      // Treat cancelled pointer (e.g. browser scroll takeover) same as up
      onUp(e);
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onCancel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  function runLookup(strokes, canvas) {
    if (!window.HanziLookup?.data?.mmah || strokes.length === 0) return;
    const c = canvas || canvasRef.current;
    if (!c) return;
    const normalized = strokes.map(stroke =>
      stroke.map(([x, y]) => [x / c.width, y / c.height])
    );
    const analyzed = new window.HanziLookup.AnalyzedCharacter(normalized);
    const matcher = new window.HanziLookup.Matcher('mmah');
    matcher.match(analyzed, 8, matches => {
      setCandidates(matches.filter(Boolean).map(m => m.character));
    });
  }

  function redraw(strokes) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#f0ede6' : '#1a1916';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
      ctx.stroke();
    }
  }

  function doClear() {
    drawStrokesRef.current = [];
    activeStrokeRef.current = null;
    setDrawStrokes([]);
    setCandidates([]);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function doUndo() {
    const newStrokes = drawStrokesRef.current.slice(0, -1);
    drawStrokesRef.current = newStrokes;
    setDrawStrokes([...newStrokes]);
    redraw(newStrokes);
    if (newStrokes.length > 0) runLookup(newStrokes);
    else setCandidates([]);
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div>
        <div className="draw-canvas" style={{ position: 'relative' }}>
          <div className="draw-grid" />
          {drawStrokes.length === 0 && (
            <div className="draw-hint" style={{ pointerEvents: 'none' }}>
              {hlReady ? 'Draw a character here' : 'Loading…'}
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              touchAction: 'none',
              cursor: 'crosshair',
              borderRadius: 8,
            }}
          />
        </div>
        <div className="draw-mini-actions">
          <button className="draw-mini-btn" onClick={doClear}>Clear</button>
          <button className="draw-mini-btn" onClick={doUndo}>↩ Undo</button>
        </div>
      </div>
      <div>
        <div className="candidates-label">
          {candidates.length > 0 ? 'Candidates — click to search' : 'Candidates'}
        </div>
        <div className="candidates">
          {candidates.map((ch, i) => (
            <button key={i} className={`cand${i === 0 ? ' hot' : ''}`}
              onClick={() => router.push(`/word/${encodeURIComponent(ch)}`)}>
              {ch}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

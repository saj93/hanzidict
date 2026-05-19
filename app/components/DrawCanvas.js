'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function DrawCanvas() {
  const router = useRouter();
  const [hlReady, setHlReady] = useState(false);
  const [drawStrokes, setDrawStrokes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function scalePos(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return [
        (clientX - rect.left) * (canvas.width / rect.width),
        (clientY - rect.top) * (canvas.height / rect.height),
      ];
    }

    function setupCtx() {
      const isDark = document.documentElement.classList.contains('dark');
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = isDark ? '#f0ede6' : '#1a1916';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    function startStroke(x, y) {
      setupCtx();
      activeStrokeRef.current = [[x, y]];
    }

    function continueStroke(x, y) {
      if (!activeStrokeRef.current) return;
      const pts = activeStrokeRef.current;
      const [px, py] = pts[pts.length - 1];
      pts.push([x, y]);
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function endStroke() {
      if (!activeStrokeRef.current) return;
      const newStrokes = [...drawStrokesRef.current, activeStrokeRef.current];
      drawStrokesRef.current = newStrokes;
      activeStrokeRef.current = null;
      setDrawStrokes([...newStrokes]);
      runLookup(newStrokes, canvas);
    }

    // ── Touch handlers (iOS Safari) ──────────────────────────────────────────
    // preventDefault on touchstart is the only reliable way to suppress the
    // iOS long-press callout on canvas. Per spec, this also blocks pointer
    // events for the same touch, so touch events handle drawing independently.
    function onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const [x, y] = scalePos(t.clientX, t.clientY);
      startStroke(x, y);
    }

    function onTouchMove(e) {
      e.preventDefault();
      if (!activeStrokeRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      const [x, y] = scalePos(t.clientX, t.clientY);
      continueStroke(x, y);
    }

    function onTouchEnd(e) {
      e.preventDefault();
      endStroke();
    }

    // ── Pointer handlers (mouse / stylus / non-touch) ────────────────────────
    // Skip touch pointers — handled above to avoid double-drawing on browsers
    // that dispatch both touch and pointer events.
    function onDown(e) {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = scalePos(e.clientX, e.clientY);
      startStroke(x, y);
    }

    function onMove(e) {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      continueStroke(...scalePos(e.clientX, e.clientY));
    }

    function onUp(e) {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      endStroke();
    }

    canvas.addEventListener('touchstart',   onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',    onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',     onTouchEnd,   { passive: false });
    canvas.addEventListener('touchcancel',  onTouchEnd,   { passive: false });
    canvas.addEventListener('pointerdown',  onDown,       { passive: false });
    canvas.addEventListener('pointermove',  onMove,       { passive: false });
    canvas.addEventListener('pointerup',    onUp,         { passive: false });
    canvas.addEventListener('pointercancel', onUp,        { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Capture-phase touchstart on the wrapper div fires before the target phase
    // and before iOS's gesture recognizer can claim the touch for the callout.
    const wrap = wrapRef.current;
    function suppressCallout(e) { e.preventDefault(); }
    wrap?.addEventListener('touchstart', suppressCallout, { passive: false, capture: true });

    return () => {
      canvas.removeEventListener('touchstart',  onTouchStart);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup',   onUp);
      canvas.removeEventListener('pointercancel', onUp);
      wrap?.removeEventListener('touchstart', suppressCallout, { capture: true });
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
        <div
          ref={wrapRef}
          className="draw-canvas"
          style={{
            position: 'relative',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        >
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
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
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
            <button
              key={i}
              className={`cand${i === 0 ? ' hot' : ''}`}
              onClick={() => router.push(`/word/${encodeURIComponent(ch)}`)}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
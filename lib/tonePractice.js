import syllables from '../content/tone-practice.json' with { type: 'json' };

export const TONES = [
  { number: 1, label: 'High', description: 'High and level', path: 'M8 12H56' },
  { number: 2, label: 'Rising', description: 'Rising', path: 'M8 24L56 6' },
  { number: 3, label: 'Dipping', description: 'Low, then rising in isolation', path: 'M8 8L30 26L56 6' },
  { number: 4, label: 'Falling', description: 'Falling', path: 'M8 6L56 26' },
];

export function createToneSession({ tones = [1, 2, 3, 4], length = 10, pairs = false } = {}, random = Math.random) {
  if (!tones.length || tones.some(t => ![1, 2, 3, 4].includes(t))) throw new Error('Select at least one valid tone');
  const candidates = syllables.flatMap(s => s.tones.filter(t => tones.includes(t.tone)).map(t => ({ ...t, syllable: s.syllable })));
  const questions = [];
  let previous = '';
  for (let i = 0; i < length; i++) {
    const firstChoices = candidates.filter(c => c.audio !== previous);
    const first = firstChoices[Math.floor(random() * firstChoices.length)];
    const clips = [first];
    if (pairs) clips.push(candidates[Math.floor(random() * candidates.length)]);
    questions.push({ clips });
    previous = first.audio;
  }
  return questions;
}

export function isToneAnswerCorrect(question, selected) {
  return question.clips.length === selected.length && question.clips.every((c, i) => c.tone === selected[i]);
}

export async function playToneSequence(audio, clips, { rate = 1, signal } = {}) {
  for (const clip of clips) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', failed);
        signal?.removeEventListener('abort', cancelled);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Audio could not be played. Please try again.')); };
      const cancelled = () => { cleanup(); audio.pause(); reject(new DOMException('Cancelled', 'AbortError')); };
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', failed, { once: true });
      signal?.addEventListener('abort', cancelled, { once: true });
      audio.src = clip.audio;
      audio.playbackRate = rate;
      audio.preservesPitch = true;
      Promise.resolve(audio.play()).catch(failed);
    });
  }
}

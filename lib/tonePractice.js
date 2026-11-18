import syllables from '../content/tone-practice.json' with { type: 'json' };

export const TONES = [
  { number: 1, label: 'High', description: 'High and level', path: 'M8 12H56' },
  { number: 2, label: 'Rising', description: 'Rising', path: 'M8 24L56 6' },
  { number: 3, label: 'Dipping', description: 'Low, then rising in isolation', path: 'M8 8L30 26L56 6' },
  { number: 4, label: 'Falling', description: 'Falling', path: 'M8 6L56 26' },
];

export function drawTone(previousAudio = '', random = Math.random) {
  const candidates = syllables.flatMap(s => s.tones.map(t => ({ ...t, syllable: s.syllable })))
    .filter(t => t.audio !== previousAudio);
  return candidates[Math.floor(random() * candidates.length)];
}

export function getToneVariants(syllable) {
  return syllables.find(s => s.syllable === syllable)?.tones || [];
}

export function toneAccuracy(correct, wrong) {
  return correct + wrong === 0 ? null : Math.round(correct / (correct + wrong) * 100);
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
      // Reusing a preloaded source avoids restarting its network request/decoder.
      if ((audio.getAttribute?.('src') ?? audio.src) !== clip.audio) audio.src = clip.audio;
      else audio.currentTime = 0;
      audio.playbackRate = rate;
      audio.preservesPitch = true;
      Promise.resolve(audio.play()).catch(failed);
    });
  }
}

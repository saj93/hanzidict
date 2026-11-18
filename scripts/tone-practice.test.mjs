import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pinyin } from 'pinyin-pro';
import { createToneSession, isToneAnswerCorrect, playToneSequence } from '../lib/tonePractice.js';
import data from '../content/tone-practice.json' with { type: 'json' };

test('All 32 audio labels match the expected Mandarin tone and exist as MP3 files', () => {
  for (const syllable of data) for (const clip of syllable.tones) {
    assert.equal(pinyin(clip.hanzi, { toneType: 'num' }), syllable.syllable + clip.tone);
    const file = readFileSync(new URL('../public' + clip.audio, import.meta.url));
    assert.ok(file.length > 500);
    assert.ok(file.subarray(0, 3).toString() === 'ID3' || file[0] === 0xff);
  }
});

test('Session options restrict tones and pairs require both answers in order', () => {
  const session = createToneSession({ tones: [2, 4], length: 20, pairs: true });
  assert.equal(session.length, 20);
  for (const q of session) {
    assert.equal(q.clips.length, 2);
    assert.ok(q.clips.every(c => [2, 4].includes(c.tone)));
    assert.ok(isToneAnswerCorrect(q, q.clips.map(c => c.tone)));
    assert.equal(isToneAnswerCorrect(q, [1, 1]), false);
    assert.equal(isToneAnswerCorrect(q, [q.clips[0].tone]), false);
  }
  assert.throws(() => createToneSession({ tones: [] }));
});

test('Single-tone practice avoids repeating the same clip consecutively', () => {
  const questions = createToneSession({ tones: [3], length: 20 });
  for (let i = 1; i < questions.length; i++) assert.notEqual(questions[i].clips[0].audio, questions[i - 1].clips[0].audio);
});

class FakeAudio extends EventTarget {
  calls = [];
  play() { this.calls.push(this.src); queueMicrotask(() => this.dispatchEvent(new Event('ended'))); return Promise.resolve(); }
  pause() {}
}
test('Audio pairs play sequentially with pitch preserved, and cancellation prevents playback', async () => {
  const audio = new FakeAudio();
  await playToneSequence(audio, [{ audio: '/one.mp3' }, { audio: '/two.mp3' }], { rate: 0.75 });
  assert.deepEqual(audio.calls, ['/one.mp3', '/two.mp3']);
  assert.equal(audio.preservesPitch, true);
  assert.equal(audio.playbackRate, 0.75);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(playToneSequence(audio, [{ audio: '/three.mp3' }], { signal: controller.signal }), e => e.name === 'AbortError');
  assert.equal(audio.calls.length, 2);
});

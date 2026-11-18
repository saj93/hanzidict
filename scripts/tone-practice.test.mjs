import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pinyin } from 'pinyin-pro';
import { drawTone, toneAccuracy, getToneVariants, playToneSequence } from '../lib/tonePractice.js';
import data from '../content/tone-practice.json' with { type: 'json' };

test('All 32 audio labels match the expected Mandarin tone and exist as MP3 files', () => {
  for (const syllable of data) for (const clip of syllable.tones) {
    assert.equal(pinyin(clip.hanzi, { toneType: 'num' }), syllable.syllable + clip.tone);
    const file = readFileSync(new URL('../public' + clip.audio, import.meta.url));
    assert.ok(file.length > 500);
    assert.ok(file.subarray(0, 3).toString() === 'ID3' || file[0] === 0xff);
  }
});

test('Practice can continue indefinitely without repeating the same clip consecutively', () => {
  let previous = '';
  for (let i = 0; i < 1000; i++) {
    const question = drawTone(previous);
    assert.notEqual(question.audio, previous);
    assert.ok([1, 2, 3, 4].includes(question.tone));
    assert.equal(getToneVariants(question.syllable).length, 4);
    previous = question.audio;
  }
});

test('Accuracy uses correct and wrong answers, including an unanswered session', () => {
  assert.equal(toneAccuracy(0, 0), null);
  assert.equal(toneAccuracy(1, 0), 100);
  assert.equal(toneAccuracy(0, 1), 0);
  assert.equal(toneAccuracy(44, 1), 98);
  assert.equal(toneAccuracy(2, 1), 67);
});

class FakeAudio extends EventTarget {
  calls = [];
  play() { this.calls.push(this.src); queueMicrotask(() => this.dispatchEvent(new Event('ended'))); return Promise.resolve(); }
  pause() {}
}
test('Audio plays with pitch preserved, and cancellation prevents playback', async () => {
  const audio = new FakeAudio();
  await playToneSequence(audio, [{ audio: '/one.mp3' }, { audio: '/two.mp3' }], { rate: 0.75 });
  assert.deepEqual(audio.calls, ['/one.mp3', '/two.mp3']);
  assert.equal(audio.preservesPitch, true);
  assert.equal(audio.playbackRate, 0.75);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(playToneSequence(audio, [{ audio: '/three.mp3' }], { signal: controller.signal }), e => e.name === 'AbortError');
  assert.equal(audio.calls.length, 2);
});

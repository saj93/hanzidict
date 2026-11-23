import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadingReport } from '../lib/loadingDiagnostics.js';

test('The report contains timing labels, never URLs, account data or credentials', () => {
  const secret = 'DO-NOT-INCLUDE-ACCOUNT-OR-TOKEN';
  const report = loadingReport({
    origin: 'https://example.test', account: 'signed_in', subscriptionPending: true, now: 1234,
    wordLoad: { loadMs: 678.9, cacheHit: false, user: { id: secret }, token: secret },
    resources: [
      { name: `https://example.test/api/subscription?token=${secret}`, duration: 999, startTime: 10, responseStatus: 503,
        serverTiming: [{ name: 'subscription_auth', duration: 444 }, { name: secret, duration: 10 }] },
      { name: `https://example.test/api/search?q=${secret}&raw=1`, duration: 500, startTime: 20 },
      { name: `https://project.supabase.co/rest/v1/admins?user_id=${secret}`, duration: 700, startTime: 15 },
      { name: `https://example.test/api/lists/${secret}`, duration: 1, startTime: 1 },
    ],
  });
  assert.equal(report.account, 'signed_in');
  assert.equal(report.word.loadMs, 679);
  assert.deepEqual(report.requests.map(r => r.label), ['subscription', 'word_entry', 'admin_check']);
  assert.equal(report.requests[0].status, 503);
  const text = JSON.stringify(report);
  assert.ok(!text.includes(secret)); assert.ok(!text.includes('https://'));
});

test('Pending or unsupported metrics remain unknown rather than claiming zero latency', () => {
  const report = loadingReport({ origin: 'https://example.test', account: 'pending', now: 100, wordLoad: { pending: true } });
  assert.equal(report.word.loadMs, null);
  assert.equal(report.mainThreadLongTasksMs, null);
  assert.equal(report.document, null);
});

test('Script/font/stroke delays use anonymous labels without revealing filenames or characters', () => {
  const report = loadingReport({ origin: 'https://example.test', resources: [
    { name: 'https://example.test/_next/static/chunks/private-name.js', duration: 100, startTime: 1 },
    { name: 'https://example.test/_next/static/media/private-font.woff2', duration: 200, startTime: 2 },
    { name: 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/秘密.json', duration: 300, startTime: 3 },
  ] });
  assert.deepEqual(report.requests.map(r => r.label), ['app_script', 'font', 'stroke_data']);
  assert.ok(!JSON.stringify(report).includes('private-'));
  assert.ok(!JSON.stringify(report).includes('秘密'));
});

test('Database preparation, HTTP attempts and retry gaps remain anonymous', () => {
  const report = loadingReport({ origin: 'https://example.test', wordLoad: { cacheBypassed: true }, resources: [
    { name: 'https://example.test/api/search?raw=1', duration: 1000, startTime: 10, serverTiming: [
      { name: 'exact_prepare', duration: 200 }, { name: 'exact_http_1_503', duration: 100 },
      { name: 'exact_retry_wait', duration: 500 }, { name: 'exact_http_2_200', duration: 150 },
      { name: 'exact_auth_1_200', duration: 100 },
      { name: 'exact_http_1_private-token', duration: 1 },
    ] },
  ] });
  assert.equal(report.format, 'hanzidict-loading-v2');
  assert.equal(report.word.cacheBypassed, true);
  assert.equal(report.requests[0].server.length, 5);
  assert.ok(!JSON.stringify(report).includes('private-token'));
});

test('Secondary detail transport timings identify the grouped lookup without leaking the word', () => {
  const report = loadingReport({ origin: 'https://example.test', resources: [
    { name: 'https://example.test/api/word-characters?word=private-word', duration: 20, startTime: 10,
      serverTiming: [{ name: 'characters_http_1_200', duration: 15 }, { name: 'details_total', duration: 18 }] },
  ] });
  assert.equal(report.requests[0].label, 'word_characters');
  assert.equal(report.requests[0].server.length, 2);
  assert.ok(!JSON.stringify(report).includes('private-word'));
});

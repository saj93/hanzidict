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

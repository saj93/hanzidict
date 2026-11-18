import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';

// Next installs this global before loading its server modules.
globalThis.AsyncLocalStorage = AsyncLocalStorage;

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
const require = createRequire(import.meta.url);
const { unstable_doesMiddlewareMatch: matches } = require('next/experimental/testing/server');
const { config } = await import('../middleware.js');

test('Next excludes public pages from routing middleware, including word navigation', () => {
  for (const path of ['/', '/word/课文', '/word/你好', '/search?q=hello', '/about', '/hsk/1', '/blog/tones', '/learn/tones']) {
    assert.equal(matches({ config, nextConfig: {}, url: 'https://hanzidict.app' + path }), false, path);
  }
});

test('Next still routes account pages and protected APIs through session refresh', () => {
  for (const path of ['/profile', '/admin/suggestions', '/lists/1', '/learn/session/1', '/auth/callback', '/login', '/api/lists']) {
    assert.equal(matches({ config, nextConfig: {}, url: 'https://hanzidict.app' + path }), true, path);
  }
});

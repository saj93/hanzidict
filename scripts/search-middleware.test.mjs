// Run: node --experimental-test-module-mocks --test scripts/search-middleware.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Next resolves this extensionless import; match that resolution under Node ESM.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });

let authCalls = 0;
mock.module('@supabase/ssr', {
  namedExports: {
    createServerClient: () => ({ auth: { getUser: async () => {
      authCalls++;
      throw new Error('Auth unavailable');
    } } }),
  },
});
mock.module('next/server.js', {
  namedExports: { NextResponse: { next: () => ({ next: true }) } },
});
const { middleware } = await import('../middleware.js');

test('Public GET search works even if the authentication service is unavailable', async () => {
  const response = await middleware({ method: 'GET', nextUrl: { pathname: '/api/search' } });
  assert.equal(response.next, true);
  assert.equal(authCalls, 0);
});

test('Authenticated pages still refresh sessions', async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  try {
    await assert.rejects(middleware({ method: 'GET', nextUrl: { pathname: '/profile' } }), /Auth unavailable/);
    assert.equal(authCalls, 1);
    await assert.rejects(middleware({ method: 'POST', nextUrl: { pathname: '/api/search' } }), /Auth unavailable/);
    assert.equal(authCalls, 2);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});

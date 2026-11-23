import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

let authReply, dbReply, authCalls, dbCalls, scopedUser;
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => ({
  auth: { getUser: async token => { authCalls++; assert.equal(token, 'test-token'); return authReply; } },
  from: table => {
    assert.equal(table, 'subscriptions'); dbCalls++;
    return { select: () => ({ eq: (column, id) => {
      assert.equal(column, 'user_id'); scopedUser = id;
      return { maybeSingle: async () => dbReply };
    } }) };
  },
}) } });
const { GET } = await import('../app/api/subscription/route.js');

beforeEach(() => {
  authCalls = 0; dbCalls = 0; scopedUser = null;
  authReply = { data: { user: { id: 'verified-user' } }, error: null };
  dbReply = { data: { plan: 'monthly', premium_until: new Date(Date.now() + 86400000).toISOString(), status: 'active' }, error: null };
});
const request = (auth = 'Bearer test-token') => new Request('https://example.test/api/subscription?user_id=untrusted-user', { headers: auth ? { Authorization: auth } : {} });

test('Missing bearer never queries account data and private responses cannot be cached', async () => {
  const r = await GET(request(null));
  assert.deepEqual(await r.json(), { isPremium: false });
  assert.equal(authCalls, 0); assert.equal(dbCalls, 0);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
});

test('Invalid tokens are rejected before any subscription lookup', async () => {
  authReply = { data: { user: null }, error: { status: 401 } };
  const r = await GET(request());
  assert.equal(r.status, 401); assert.equal(authCalls, 1); assert.equal(dbCalls, 0);
});

test('One token validation scopes the lookup to its verified user', async () => {
  const r = await GET(request()); const body = await r.json();
  assert.equal(body.isPremium, true); assert.equal(body.plan, 'monthly');
  assert.equal(authCalls, 1); assert.equal(dbCalls, 1); assert.equal(scopedUser, 'verified-user');
  assert.match(r.headers.get('server-timing'), /subscription_auth;dur=/);
  assert.match(r.headers.get('server-timing'), /subscription_db;dur=/);
});

test('A missing subscription is a valid non-premium account', async () => {
  dbReply = { data: null, error: null };
  const r = await GET(request());
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { isPremium: false });
});

test('Expired and cancelled subscriptions never grant premium', async () => {
  for (const change of [{ premium_until: '2000-01-01T00:00:00Z' }, { status: 'cancelled' }]) {
    const original = dbReply.data;
    dbReply = { data: { ...original, ...change }, error: null };
    assert.equal((await (await GET(request())).json()).isPremium, false);
    dbReply.data = original;
  }
});

test('Auth/database outages return an error rather than a false premium downgrade', async () => {
  authReply = { data: { user: null }, error: { status: 503 } };
  assert.equal((await GET(request())).status, 503);
  authReply = { data: { user: { id: 'verified-user' } }, error: null };
  dbReply = { data: null, error: { code: '57014' } };
  assert.equal((await GET(request())).status, 503);
});

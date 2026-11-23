// Run after npm run build: node scripts/word-details-cache.integration.cjs
// All database/auth traffic uses a loopback fixture, including simulated edits.
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

(async () => {
  const counts = { examples: 0, related: 0, characters: 0 };
  let failExamples = false, definition = 'you', english = 'hello';
  const rows = () => [
    { id: 1, simplified: '你', traditional: '你', pinyin: 'ni3', definitions: definition, radical: '亻', stroke_count: 7 },
    { id: 2, simplified: '好', traditional: '好', pinyin: 'hao3', definitions: 'good', radical: '女', stroke_count: 6 },
  ];
  const fixture = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture');
    const reply = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/auth/v1/user') return req.headers.authorization === 'Bearer fixture-admin'
      ? reply({ id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated' })
      : reply({ message: 'Invalid token' }, 401);
    if (url.pathname === '/rest/v1/admins') return reply([{ user_id: '00000000-0000-4000-8000-000000000001' }]);
    if (req.method === 'PATCH') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (url.pathname === '/rest/v1/examples') { english = body.english; return reply({ id: 1, chinese: '你好。', english }); }
      if (url.pathname === '/rest/v1/entries') { definition = body.definitions; return reply(rows()[0]); }
    }
    if (url.pathname === '/rest/v1/examples') {
      counts.examples++;
      if (failExamples) return reply({ message: 'Fixture outage', code: 'fixture' }, 400);
      await new Promise(resolve => setTimeout(resolve, 300));
      return reply([{ id: 1, chinese: '你好。', pinyin: 'ni3 hao3', english }]);
    }
    if (url.pathname === '/rest/v1/entries') {
      if (url.searchParams.has('hsk_level')) {
        counts.related++; await new Promise(resolve => setTimeout(resolve, 300));
        return reply(Array.from({ length: 5 }, (_, i) => ({ simplified: '你' + i, traditional: '你' + i, pinyin: 'ni3', definitions: 'fixture', hsk_level: 1 })));
      }
      counts.characters++; await new Promise(resolve => setTimeout(resolve, 300));
      return reply(rows());
    }
    return reply({ message: 'Unexpected fixture request' }, 404);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const reservation = http.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(), env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`, SUPABASE_SERVICE_KEY: 'fixture-service-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; server.stdout.on('data', b => { output += b; }); server.stderr.on('data', b => { output += b; });
  const get = async (path, options) => {
    const r = await fetch(origin + path, options); const body = await r.json();
    return { r, body };
  };
  const auth = { Authorization: 'Bearer fixture-admin', 'Content-Type': 'application/json' };
  try {
    const deadline = Date.now() + 15000;
    while (!output.includes('Ready in') && Date.now() < deadline && server.exitCode === null) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(output.includes('Ready in'), 'Production test server did not start');
    const runWord = '你好你' + Date.now();
    const word = encodeURIComponent(runWord);
    const calls = ['/api/example', '/api/related', '/api/word-characters'].map(p => `${p}?word=${word}`);
    const cold = await Promise.all(calls.map(path => get(path)));
    cold.forEach(({ r }) => assert.equal(r.status, 200));
    assert.deepEqual(cold[2].body.results.map(e => e.simplified), Array.from(runWord));
    assert.equal(cold[2].body.results[0].radical, '亻');
    assert.match(cold[2].r.headers.get('server-timing'), /characters_http_1_200/);
    const afterCold = { ...counts };
    // A different visitor's cookie/authorization must not enter the public key.
    const warm = await Promise.all(calls.map(path => get(path, { headers: { Cookie: 'unrelated=fixture', Authorization: 'Bearer unrelated-fixture' } })));
    warm.forEach(({ r }) => assert.equal(r.status, 200));
    assert.deepEqual(counts, afterCold, 'Warm public requests must not query the database again');
    assert.ok(!warm[2].r.headers.get('server-timing').includes('characters_http_'));
    console.log('PASS public details share the real Next cache across visitors; one batched character lookup.');
    failExamples = true;
    const failedPath = '/api/example?word=' + encodeURIComponent('失败' + Date.now());
    assert.equal((await get(failedPath)).r.status, 503);
    failExamples = false;
    assert.equal((await get(failedPath)).r.status, 200);
    console.log('PASS an upstream failure is not cached as an empty result.');
    const beforeDenied = { ...counts };
    assert.equal((await get('/api/entries/1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definitions: 'denied' }) })).r.status, 401);
    await get(calls[2]); assert.deepEqual(counts, beforeDenied, 'Unauthorized edits must not evict public data');
    assert.equal((await get('/api/entries/1', { method: 'PATCH', headers: auth, body: JSON.stringify({ definitions: 'updated definition' }) })).r.status, 200);
    const changed = await get(calls[2]);
    assert.equal(changed.body.results[0].definitions, 'updated definition');
    assert.equal(counts.characters, beforeDenied.characters + 1);
    await get(calls[1]); assert.equal(counts.related, beforeDenied.related + 1);
    assert.equal((await get('/api/examples/1', { method: 'PATCH', headers: auth, body: JSON.stringify({ chinese: '你好。', pinyin: 'ni3 hao3', english: 'updated translation' }) })).r.status, 200);
    assert.equal((await get(calls[0])).body.results[0].english, 'updated translation');
    console.log('PASS simulated authorized edits expire cached details; unauthorized requests cannot.');
  } catch (error) {
    console.error(output); throw error;
  } finally {
    if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

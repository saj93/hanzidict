const TIMINGS = new Set(['exact', 'partial', 'pinyin', 'english', 'english_exact', 'hydrate', 'search', 'examples', 'related', 'characters', 'details_total', 'subscription_auth', 'subscription_db', 'subscription_total']);
const TRANSPORT_TIMING = /^(?:exact|partial|pinyin|english|english_exact|hydrate|examples|related|characters)_(?:prepare|retry_wait|(?:http|auth)_(?:[1-8]|more)_(?:[1-5][0-9]{2}|network_error|unknown))$/;
const ms = n => Number.isFinite(n) ? Math.round(n) : null;

// Deliberately whitelist labels: never copy URLs, query strings, headers,
// tokens, user objects, account IDs, or dictionary contents into a report.
function resourceLabel(name, origin) {
  try {
    const u = new URL(name);
    if (u.origin === origin) {
      if (u.pathname.startsWith('/_next/static/')) {
        if (u.pathname.endsWith('.js')) return 'app_script';
        if (u.pathname.endsWith('.css')) return 'app_styles';
        if (/\.woff2?$/.test(u.pathname)) return 'font';
      }
      if (u.pathname === '/api/search') return u.searchParams.get('raw') === '1' ? 'word_entry' : 'search';
      return ({ '/api/subscription': 'subscription', '/api/related': 'related_words', '/api/example': 'examples', '/api/word-characters': 'word_characters', '/api/chengyu': 'chengyu' })[u.pathname];
    }
    if (u.hostname === 'cdn.jsdelivr.net') {
      if (u.pathname.includes('/hanzi-writer-data@')) return 'stroke_data';
      if (u.pathname.includes('/hanzi-writer@')) return 'stroke_player';
    }
    if (u.hostname.endsWith('.supabase.co')) return ({ '/auth/v1/token': 'session_refresh', '/auth/v1/user': 'session_verification', '/rest/v1/admins': 'admin_check', '/rest/v1/list_entries': 'saved_word_check' })[u.pathname];
  } catch {}
}

export function loadingReport({ origin, account, subscriptionPending, accountChecksDeferred, wordLoad, resources = [], navigation, now, longTasks }) {
  return {
    format: 'hanzidict-loading-v2',
    account: ['signed_in', 'signed_out', 'pending'].includes(account) ? account : 'unknown',
    subscriptionPending: !!subscriptionPending,
    accountChecksDeferred: !!accountChecksDeferred,
    capturedAtMs: ms(now),
    document: navigation ? {
      htmlResponseMs: ms(navigation.responseStart - navigation.requestStart),
      dnsMs: ms(navigation.domainLookupEnd - navigation.domainLookupStart),
      connectionMs: ms(navigation.connectEnd - navigation.connectStart),
      domReadyMs: ms(navigation.domContentLoadedEventEnd),
    } : null,
    word: wordLoad ? { pending: !!wordLoad.pending, cacheHit: !!wordLoad.cacheHit, cacheBypassed: !!wordLoad.cacheBypassed, loadMs: ms(wordLoad.loadMs), failed: !!wordLoad.failed } : null,
    mainThreadLongTasksMs: Array.isArray(longTasks) ? ms(longTasks.reduce((sum, t) => sum + t.duration, 0)) : null,
    requests: resources.flatMap(r => {
      const label = resourceLabel(r.name, origin);
      if (!label) return [];
      return [{ label, startedAtMs: ms(r.startTime), durationMs: ms(r.duration),
        ...(r.responseStatus >= 100 && r.responseStatus <= 599 ? { status: r.responseStatus } : {}),
        server: (r.serverTiming || []).filter(t => TIMINGS.has(t.name) || TRANSPORT_TIMING.test(t.name)).map(t => ({ name: t.name, ms: ms(t.duration) })),
      }];
    }).slice(-30),
  };
}

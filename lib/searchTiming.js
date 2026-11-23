import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const STEPS = new Set(['exact', 'partial', 'pinyin', 'english', 'english_exact', 'hydrate']);

// Request-local timings: parallel requests must never share measurements.
export function withSearchTiming(timings, operation) {
  return storage.run({ timings }, operation);
}

export async function measureSearchStep(name, operation) {
  const parent = storage.getStore();
  if (!parent) return operation();
  const { timings } = parent;
  const start = performance.now();
  try {
    // PostgREST builders are lazy thenables: await them inside the scope so
    // their eventual network requests inherit this operation's context.
    return await storage.run({ timings, step: STEPS.has(name) ? name : null, startedAt: start, counts: {}, lastHttpEnd: null }, async () => await operation());
  } finally {
    timings[name] = (timings[name] || 0) + performance.now() - start;
  }
}

// The SDK invokes its custom fetch after preparing authentication headers.
// Record only elapsed time, transport kind, attempt number and HTTP status.
// Inputs, URLs, headers, credentials and response bodies are never recorded.
export function traceDatabaseFetch(fetcher = (...args) => fetch(...args)) {
  return async (input, init) => {
    const scope = storage.getStore();
    if (!scope?.step) return fetcher(input, init);
    const { timings, step } = scope;
    let kind = 'http';
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname.startsWith('/auth/v1/')) kind = 'auth';
    } catch {}
    const start = performance.now();
    const count = (scope.counts[kind] || 0) + 1;
    scope.counts[kind] = count;
    let retryNumber = null;
    if (kind === 'http') {
      if (count === 1) timings[`${step}_prepare`] = start - scope.startedAt;
      try {
        const raw = new Headers(init?.headers).get('X-Retry-Count');
        if (raw !== null && /^[0-7]$/.test(raw)) retryNumber = Number(raw);
      } catch {}
      if (retryNumber > 0 && scope.lastHttpEnd !== null) {
        // This gap includes SDK backoff, draining the previous response body
        // and preparing the next attempt; it is not pure network latency.
        timings[`${step}_retry_wait`] = (timings[`${step}_retry_wait`] || 0) + start - scope.lastHttpEnd;
      }
    }
    // Some SDK attempts can fail while preparing authentication, before custom
    // fetch is reached. Preserve the SDK ordinal instead of calling a later
    // successful attempt the first one.
    const ordinal = kind === 'http' && retryNumber !== null ? retryNumber + 1 : count;
    const slot = ordinal <= 8 ? String(ordinal) : 'more';
    let status = 'network_error';
    try {
      const response = await fetcher(input, init);
      status = response.status >= 100 && response.status <= 599 ? String(response.status) : 'unknown';
      return response;
    } finally {
      const end = performance.now();
      const name = `${step}_${kind}_${slot}_${status}`;
      timings[name] = (timings[name] || 0) + end - start;
      if (kind === 'http') scope.lastHttpEnd = end;
    }
  };
}

export function searchTimingHeader(timings, total) {
  return [...Object.entries(timings), ['search', total]]
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
    .join(', ');
}

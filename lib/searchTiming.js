import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

// Request-local timings: parallel requests must never share measurements.
export function withSearchTiming(timings, operation) {
  return storage.run(timings, operation);
}

export async function measureSearchStep(name, operation) {
  const timings = storage.getStore();
  if (!timings) return operation();
  const start = performance.now();
  try {
    return await operation();
  } finally {
    timings[name] = (timings[name] || 0) + performance.now() - start;
  }
}

export function searchTimingHeader(timings, total) {
  return [...Object.entries(timings), ['search', total]]
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
    .join(', ');
}

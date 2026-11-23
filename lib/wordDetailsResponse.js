import { withSearchTiming, measureSearchStep, searchTimingHeader } from './searchTiming.js';

export async function wordDetailsResponse(request, step, load) {
  const started = performance.now();
  const timings = {};
  const headers = () => ({
    'Cache-Control': 'no-store',
    'Server-Timing': searchTimingHeader(timings, performance.now() - started, 'details_total'),
  });
  const word = new URL(request.url).searchParams.get('word')?.trim();
  if (!word) return Response.json({ results: [] }, { headers: headers() });
  if (Array.from(word).length > 64) return Response.json({ error: 'Word is too long' }, { status: 400, headers: headers() });
  try {
    const results = await withSearchTiming(timings, () => measureSearchStep(step, () => load(word)));
    return Response.json({ results }, { headers: headers() });
  } catch {
    // Never turn a database outage into a successful empty, cacheable result.
    return Response.json({ error: 'Word details are temporarily unavailable' }, { status: 503, headers: headers() });
  }
}

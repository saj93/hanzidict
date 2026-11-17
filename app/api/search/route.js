import { searchEntries } from '../../../lib/db';
import { withSearchTiming, searchTimingHeader } from '../../../lib/searchTiming';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const start = performance.now();
  const timings = {};
  const headers = () => ({
    'Cache-Control': 'no-store',
    'Server-Timing': searchTimingHeader(timings, performance.now() - start),
  });
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  if (!query || query.trim() === '') {
    return Response.json({ results: [], total: 0 }, { headers: headers() });
  }

  const raw = searchParams.get('raw') === '1';
  const exactOnly = searchParams.get('exact') === '1';
  if (searchParams.get('stream') === '1') {
    let cancelled = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = frame => {
          if (!cancelled) {
            try { controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n')); }
            catch { cancelled = true; }
          }
        };
        send({ type: 'start' });
        withSearchTiming(timings, () => searchEntries(query, page, limit, raw, exactOnly,
          data => send({ type: 'preview', ...data })
        )).then(data => {
          send({ type: 'complete', ...data, timing: searchTimingHeader(timings, performance.now() - start) });
        }).catch(error => {
          console.error('[search] streaming query failed', error?.code || 'unknown');
          send({ type: 'error', code: error?.code === '57014' ? 'SEARCH_TIMEOUT' : 'SEARCH_UNAVAILABLE' });
        }).finally(() => { if (!cancelled) controller.close(); });
      },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    } });
  }
  try {
    const { results, total } = await withSearchTiming(timings, () => searchEntries(query, page, limit, raw, exactOnly));
    return Response.json({ results, total }, { headers: headers() });
  } catch (error) {
    console.error('[search] query failed', error?.code || 'unknown');
    return Response.json(
      {
        error: 'Search is temporarily unavailable. Please try again.',
        code: error?.code === '57014' ? 'SEARCH_TIMEOUT' : 'SEARCH_UNAVAILABLE',
      },
      { status: 503, headers: headers() }
    );
  }
}

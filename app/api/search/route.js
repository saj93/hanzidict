import { searchEntries } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  if (!query || query.trim() === '') {
    return Response.json({ results: [], total: 0 });
  }

  const raw = searchParams.get('raw') === '1';
  const exactOnly = searchParams.get('exact') === '1';
  try {
    const { results, total } = await searchEntries(query, page, limit, raw, exactOnly);
    return Response.json({ results, total }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[search] query failed', error?.code || 'unknown');
    return Response.json(
      { error: 'Search is temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

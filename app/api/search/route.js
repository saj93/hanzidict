import { searchEntries } from '../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  if (!query || query.trim() === '') {
    return Response.json({ results: [], total: 0 });
  }

  const raw = searchParams.get('raw') === '1';
  const { results, total } = await searchEntries(query, page, limit, raw);
  return Response.json({ results, total });
}
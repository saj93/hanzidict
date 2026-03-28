import { searchEntries } from '../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim() === '') {
    return Response.json({ results: [] });
  }

  const results = await searchEntries(query);
  return Response.json({ results });
}
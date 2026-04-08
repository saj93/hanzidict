import { getRelated } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word')?.trim();
  if (!word) return Response.json({ results: [] });
  const results = await getRelated(word);
  return Response.json({ results });
}

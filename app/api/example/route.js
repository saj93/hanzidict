import { getExample } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word')?.trim();
  if (!word) return Response.json({ error: 'missing word' }, { status: 400 });

  const result = await getExample(word);
  if (!result) return Response.json({ error: 'no example' }, { status: 404 });

  return Response.json(result);
}

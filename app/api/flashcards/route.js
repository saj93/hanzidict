import { getHskCounts, getFlashcards } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('counts') === '1') {
    const counts = await getHskCounts();
    return Response.json({ counts });
  }

  const hsk = parseInt(searchParams.get('hsk') || '1', 10);
  if (hsk < 1 || hsk > 9) return Response.json({ cards: [] });

  const cards = await getFlashcards(hsk);
  return Response.json({ cards });
}

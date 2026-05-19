import { unstable_noStore as noStore } from 'next/cache';
import { getHskCounts, getFlashcards } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  noStore();
  const { searchParams } = new URL(request.url);

  const noCache = { headers: { 'Cache-Control': 'no-store' } };

  if (searchParams.get('counts') === '1') {
    const counts = await getHskCounts();
    return Response.json({ counts }, noCache);
  }

  const hsk = parseInt(searchParams.get('hsk') || '1', 10);
  if (hsk < 1 || hsk > 9) return Response.json({ cards: [] }, noCache);

  const cards = await getFlashcards(hsk);
  return Response.json({ cards }, noCache);
}
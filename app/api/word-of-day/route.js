import { getWordOfDay } from '../../../lib/db';

export async function GET() {
  try {
    const word = await getWordOfDay();
    if (!word) return Response.json(null);
    const res = Response.json(word);
    res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res;
  } catch (e) {
    console.error('[word-of-day]', e);
    return Response.json(null);
  }
}

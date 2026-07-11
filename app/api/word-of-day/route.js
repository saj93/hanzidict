import { getWordOfDay } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const word = await getWordOfDay();
    if (!word) return Response.json(null);
    const res = Response.json(word);
    res.headers.set('Cache-Control', 'private, no-cache');
    return res;
  } catch (e) {
    console.error('[word-of-day]', e);
    return Response.json(null);
  }
}

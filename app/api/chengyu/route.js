import { getChengyuByChar, getChengyuPage } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const char  = searchParams.get('char');
  const page  = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const search = (searchParams.get('q') || '').trim();
  const limit = 50;

  try {
    if (char) {
      const results = await getChengyuByChar(char, 5);
      return Response.json({ results });
    }
    const { entries, total } = await getChengyuPage(page, limit, search);
    return Response.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch {
    // is_chengyu column may not exist yet — return empty gracefully
    return Response.json({ results: [], entries: [], total: 0, pages: 1 });
  }
}

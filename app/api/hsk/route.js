import { getHskPage } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const level = parseInt(searchParams.get('level') || '1', 10);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 50;

  if (level < 1 || level > 7) return Response.json({ entries: [], total: 0 });

  const { entries, total } = await getHskPage(level, page, limit);
  return Response.json({ entries, total, page, pages: Math.ceil(total / limit) });
}

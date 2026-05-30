import { getRadicalPage } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const radical = searchParams.get('r');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 50;

  if (!radical) return Response.json({ entries: [], total: 0 });

  const { entries, total } = await getRadicalPage(radical, page, limit);
  return Response.json({ entries, total, page, pages: Math.ceil(total / limit) });
}

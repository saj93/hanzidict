import { getUserFromToken, getDeckStats } from '@/lib/db';

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await getUserFromToken(token);
  if (!dbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = await getDeckStats(dbUser.id, [1, 2, 3, 4, 5, 6, 7]);
  return Response.json({ stats });
}

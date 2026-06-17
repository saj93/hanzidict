import { getUserFromToken, getProfileStats } from '@/lib/db';

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await getUserFromToken(token);
  if (!dbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = await getProfileStats(dbUser.id);
  return Response.json({ stats });
}

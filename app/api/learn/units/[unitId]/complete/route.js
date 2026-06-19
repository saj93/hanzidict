import { getUserFromToken, markUnitComplete, getLearnStreak } from '@/lib/db';
import { UNITS } from '@/content/units';

export async function POST(request, { params }) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const unitId = parseInt(params.unitId, 10);
  if (!UNITS.find(u => u.id === unitId)) {
    return Response.json({ error: 'Invalid unit' }, { status: 400 });
  }

  await markUnitComplete(user.id, unitId);
  const streak = await getLearnStreak(user.id);
  return Response.json({ ok: true, streak });
}

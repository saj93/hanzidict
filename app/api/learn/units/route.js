import { getUserFromToken, getUnitProgress, getLearnStreak } from '@/lib/db';
import { UNITS } from '@/content/units';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  const user = token ? await getUserFromToken(token) : null;

  let completedSet = new Set();
  let streak = 0;

  if (user) {
    const [progress, s] = await Promise.all([
      getUnitProgress(user.id),
      getLearnStreak(user.id),
    ]);
    completedSet = new Set(progress.map(p => p.unit_id));
    streak = s;
  }

  const units = UNITS.map((u, i) => {
    const completed = completedSet.has(u.id);
    const prevCompleted = i === 0 || completedSet.has(u.id - 1);
    const unlocked = i === 0 || prevCompleted;
    return { ...u, completed, unlocked };
  });

  return Response.json({ units, streak });
}

import { getUserFromToken, getUnitProgress, getLearnStreak, isAdmin } from '@/lib/db';
import { UNITS } from '@/content/units';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  const user = token ? await getUserFromToken(token) : null;

  let completedSet = new Set();
  let streak = 0;

  let admin = false;
  if (user) {
    const [progress, s, adminCheck] = await Promise.all([
      getUnitProgress(user.id),
      getLearnStreak(user.id),
      isAdmin(user.id),
    ]);
    completedSet = new Set(progress.map(p => p.unit_id));
    streak = s;
    admin = adminCheck;
  }

  const units = UNITS.map((u, i) => {
    const completed = completedSet.has(u.id);
    const prevCompleted = i === 0 || completedSet.has(u.id - 1);
    const unlocked = admin || i === 0 || prevCompleted;
    return { ...u, completed, unlocked };
  });

  return Response.json({ units, streak });
}

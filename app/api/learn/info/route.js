import { getUserFromToken, getLevelProgress, hasSessionToday, getLearnStreak } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const level = parseInt(searchParams.get('level') || '1', 10);

  const user = await getUser(request);
  if (!user) {
    return Response.json({ streak: 0, today_done: false, words_learned: 0 });
  }

  const [wordsLearned, todayDone, streak] = await Promise.all([
    getLevelProgress(user.id, level),
    hasSessionToday(user.id, level),
    getLearnStreak(user.id),
  ]);

  return Response.json({ streak, today_done: todayDone, words_learned: wordsLearned });
}
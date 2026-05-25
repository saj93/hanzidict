import { getUserFromToken, getLearnCards, recordLearnSession, getLearnStreak, getUserIsPremium } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FREE_LEVELS = new Set([1, 2, 3, 4]);

async function getUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function GET(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const level = parseInt(searchParams.get('level') || '1', 10);

  if (!FREE_LEVELS.has(level)) {
    const isPremium = await getUserIsPremium(user.id);
    if (!isPremium) return Response.json({ error: 'Premium required' }, { status: 403 });
  }

  const cards = await getLearnCards(user.id, level);
  return Response.json({ cards });
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { hsk_level } = await request.json().catch(() => ({}));
  if (!hsk_level) return Response.json({ error: 'Missing hsk_level' }, { status: 400 });

  await recordLearnSession(user.id, hsk_level);
  const streak = await getLearnStreak(user.id);
  return Response.json({ ok: true, streak });
}
import { getUserFromToken, getUserListsWithWord, getUserLists, getUserListCount, createList, getUserIsPremium } from '@/lib/db';

async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function GET(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const simplified = searchParams.get('simplified');
  const lists = simplified
    ? await getUserListsWithWord(user.id, simplified)
    : await getUserLists(user.id);
  return Response.json({ lists });
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 });
  const [count, isPremium] = await Promise.all([
    getUserListCount(user.id),
    getUserIsPremium(user.id),
  ]);
  if (!isPremium && count >= 3) {
    return Response.json({ error: 'Free plan allows max 3 lists', upgrade: true }, { status: 403 });
  }
  try {
    const list = await createList(user.id, name.trim());
    return Response.json({ list });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

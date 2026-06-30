import { NextResponse } from 'next/server';
import { getUserFromToken, isAdmin, setWordOfDayOverride } from '@/lib/db';

async function getAuthedAdmin(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const user = await getUserFromToken(token);
  if (!user) return null;
  return (await isAdmin(user.id)) ? user : null;
}

export async function POST(request) {
  const user = await getAuthedAdmin(request);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { simplified } = await request.json();
  if (typeof simplified !== 'string') {
    return NextResponse.json({ error: 'simplified must be a string' }, { status: 400 });
  }

  await setWordOfDayOverride(simplified || null);
  return NextResponse.json({ ok: true, simplified: simplified || null });
}

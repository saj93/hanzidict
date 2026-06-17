import { NextResponse } from 'next/server';
import { getUserFromToken, isAdmin, updateExample, deleteExample } from '@/lib/db';

async function getAuthedUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function PATCH(request, { params }) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { chinese, pinyin, english } = body;

  if (!chinese || !english) {
    return NextResponse.json({ error: 'chinese and english are required' }, { status: 400 });
  }

  try {
    const example = await updateExample(id, { chinese: chinese.trim(), pinyin: pinyin?.trim() || '', english: english.trim() });
    return NextResponse.json({ example });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    await deleteExample(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

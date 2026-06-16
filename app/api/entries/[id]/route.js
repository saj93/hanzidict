import { NextResponse } from 'next/server';
import { getUserFromToken, isAdmin, updateEntryDefinitions } from '@/lib/db';

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
  if (typeof body.definitions !== 'string') {
    return NextResponse.json({ error: 'definitions must be a string' }, { status: 400 });
  }

  try {
    const entry = await updateEntryDefinitions(id, body.definitions.trim());
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

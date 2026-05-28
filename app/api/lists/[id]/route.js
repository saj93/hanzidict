import { getUserFromToken, getList, deleteList, renameList } from '@/lib/db';

async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function GET(request, { params }) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const list = await getList(id, user.id);
  if (!list) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ list });
}

export async function PATCH(request, { params }) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { name } = await request.json().catch(() => ({}));
  const trimmed = name?.trim();
  if (!trimmed) return Response.json({ error: 'Name required' }, { status: 400 });
  if (trimmed.length > 60) return Response.json({ error: 'Name too long' }, { status: 400 });
  try {
    const list = await renameList(id, user.id, trimmed);
    return Response.json({ list });
  } catch {
    return Response.json({ error: 'Failed to rename' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await deleteList(id, user.id);
  return Response.json({ ok: true });
}

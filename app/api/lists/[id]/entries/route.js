import { getUserFromToken, addToList, removeFromList } from '@/lib/db';

async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function POST(request, { params }) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { simplified } = await request.json();
  if (!simplified) return Response.json({ error: 'simplified required' }, { status: 400 });
  try {
    await addToList(id, user.id, simplified);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { simplified } = await request.json();
  if (!simplified) return Response.json({ error: 'simplified required' }, { status: 400 });
  try {
    await removeFromList(id, user.id, simplified);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404 });
  }
}

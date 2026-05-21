import { getUserFromToken, getListStudyCards } from '@/lib/db';

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
  const cards = await getListStudyCards(id, user.id);
  if (cards === null) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ cards });
}

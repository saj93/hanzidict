import { supabase, getUserFromToken, isAdmin } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

async function getAuthedAdmin(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const user = await getUserFromToken(token);
  if (!user) return null;
  return (await isAdmin(user.id)) ? user : null;
}

export async function GET(request) {
  const user = await getAuthedAdmin(request);
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';

  const { data, error } = await supabase
    .from('suggestions')
    .select(`
      id, field, current_value, suggested_value, reason, status, created_at,
      entry:entry_id (id, simplified, pinyin, definitions)
    `)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/suggestions] fetch error:', error);
    return Response.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }

  return Response.json({ suggestions: data });
}

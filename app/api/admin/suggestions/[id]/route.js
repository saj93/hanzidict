import { supabase, getUserFromToken, isAdmin } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

async function getAuthedAdmin(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const user = await getUserFromToken(token);
  if (!user) return null;
  return (await isAdmin(user.id)) ? user : null;
}

export async function POST(request, { params }) {
  const user = await getAuthedAdmin(request);
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { action } = await request.json();

  if (!['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  // Fetch the suggestion
  const { data: suggestion, error: fetchErr } = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !suggestion) {
    return Response.json({ error: 'Suggestion not found' }, { status: 404 });
  }

  if (action === 'approve') {
    // Apply the correction to the entry for Definition and Pinyin fields
    if (suggestion.field === 'Definition' && suggestion.entry_id) {
      const { error: updateErr } = await supabase
        .from('entries')
        .update({ definitions: suggestion.suggested_value })
        .eq('id', suggestion.entry_id);
      if (updateErr) {
        console.error('[suggestions/approve] definition update error:', updateErr);
        return Response.json({ error: 'Failed to update entry' }, { status: 500 });
      }
    } else if (suggestion.field === 'Pinyin' && suggestion.entry_id) {
      const { error: updateErr } = await supabase
        .from('entries')
        .update({ pinyin: suggestion.suggested_value })
        .eq('id', suggestion.entry_id);
      if (updateErr) {
        console.error('[suggestions/approve] pinyin update error:', updateErr);
        return Response.json({ error: 'Failed to update entry' }, { status: 500 });
      }
    }
    // Example sentence and Other: mark approved, admin handles manually
  }

  const { error: statusErr } = await supabase
    .from('suggestions')
    .update({ status: action === 'approve' ? 'approved' : 'rejected' })
    .eq('id', id);

  if (statusErr) {
    console.error('[suggestions] status update error:', statusErr);
    return Response.json({ error: 'Failed to update status' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

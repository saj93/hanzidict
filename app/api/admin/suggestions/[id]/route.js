import {
  getSuggestionById, setSuggestionStatus,
  updateEntryDefinitions, updateEntryPinyin,
  getUserFromToken, isAdmin,
} from '../../../../../lib/db';

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

  let suggestion;
  try {
    suggestion = await getSuggestionById(id);
  } catch {
    return Response.json({ error: 'Suggestion not found' }, { status: 404 });
  }

  if (action === 'approve' && suggestion.entry_id) {
    try {
      if (suggestion.field === 'Definition') {
        await updateEntryDefinitions(suggestion.entry_id, suggestion.suggested_value);
      } else if (suggestion.field === 'Pinyin') {
        await updateEntryPinyin(suggestion.entry_id, suggestion.suggested_value);
      }
    } catch (e) {
      console.error('[suggestions/approve] entry update error:', e);
      return Response.json({ error: 'Failed to update entry' }, { status: 500 });
    }
  }

  try {
    await setSuggestionStatus(id, action === 'approve' ? 'approved' : 'rejected');
  } catch (e) {
    console.error('[suggestions] status update error:', e);
    return Response.json({ error: 'Failed to update status' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

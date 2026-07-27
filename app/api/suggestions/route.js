import { Resend } from 'resend';
import { supabase, getUserFromToken } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { entry_id, field, current_value, suggested_value, reason, simplified } = body;

  if (!entry_id || !field || !suggested_value?.trim()) {
    return Response.json({ error: 'entry_id, field, and suggested_value are required' }, { status: 400 });
  }

  const validFields = ['Definition', 'Pinyin', 'Example sentence', 'Other'];
  if (!validFields.includes(field)) {
    return Response.json({ error: 'Invalid field' }, { status: 400 });
  }

  // Resolve user id if logged in (optional)
  let user_id = null;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    const user = await getUserFromToken(token);
    if (user) user_id = user.id;
  }

  const { data, error } = await supabase.from('suggestions').insert({
    entry_id,
    user_id,
    field,
    current_value: current_value || null,
    suggested_value: suggested_value.trim(),
    reason: reason?.trim() || null,
  }).select().single();

  if (error) {
    console.error('[suggestions] insert error:', error);
    return Response.json({ error: 'Failed to save suggestion' }, { status: 500 });
  }

  // Email notification (fire-and-forget — don't block the response)
  const adminEmail = process.env.ADMIN_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (adminEmail && resendKey) {
    const resend = new Resend(resendKey);
    resend.emails.send({
      from: 'HanziDict <daily@hanzidict.app>',
      to: adminEmail,
      subject: `Correction suggested for ${simplified || `entry #${entry_id}`}`,
      text: [
        `Word: ${simplified || `entry #${entry_id}`}`,
        `Field: ${field}`,
        `Current: ${current_value || '(not provided)'}`,
        `Suggested: ${suggested_value.trim()}`,
        `Reason: ${reason?.trim() || '(none)'}`,
        '',
        `Review: https://hanzidict.app/admin/suggestions`,
      ].join('\n'),
    }).catch(e => console.error('[suggestions] email error:', e));
  }

  return Response.json({ ok: true, id: data.id });
}

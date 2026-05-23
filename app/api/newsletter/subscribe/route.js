import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey) {
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Resend contact create error:', err);
    return Response.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
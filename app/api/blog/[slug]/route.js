import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserFromToken, isAdmin } from '@/lib/db';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  const { slug } = await params;
  const body = await request.json();

  const updates = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string')       updates.title       = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (typeof body.content === 'string')     updates.content     = body.content;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates)
    .eq('slug', slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

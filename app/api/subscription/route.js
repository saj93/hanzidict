import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ isPremium: false });
  }

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return Response.json({ isPremium: false });
  }

  const { data } = await supabase
    .from('subscriptions')
    .select('plan, premium_until')
    .eq('user_id', user.id)
    .single();

  if (!data?.premium_until) {
    return Response.json({ isPremium: false });
  }

  const isPremium = new Date(data.premium_until) > new Date();
  return Response.json({ isPremium, plan: data.plan, premiumUntil: data.premium_until });
}

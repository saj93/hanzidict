import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const start = performance.now();
  const timings = {};
  const respond = (body, status = 200) => Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store',
    'Server-Timing': [...Object.entries(timings), ['subscription_total', performance.now() - start]]
      .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', '),
  } });
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ isPremium: false });
  }

  const authStart = performance.now();
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  timings.subscription_auth = performance.now() - authStart;
  if (error || !user) {
    return respond({ error: 'Subscription verification unavailable' }, error?.status >= 500 ? 503 : 401);
  }

  const dbStart = performance.now();
  const { data, error: dbError } = await supabase
    .from('subscriptions')
    .select('plan, premium_until, status')
    .eq('user_id', user.id)
    .maybeSingle();
  timings.subscription_db = performance.now() - dbStart;

  if (dbError) return respond({ error: 'Subscription lookup unavailable' }, 503);

  if (!data?.premium_until) {
    return respond({ isPremium: false });
  }

  const isPremium = data.status !== 'cancelled' && new Date(data.premium_until) > new Date();
  return respond({ isPremium, plan: data.plan, premiumUntil: data.premium_until, status: data.status });
}

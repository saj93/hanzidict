import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const PRICE_IDS = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    annual:  process.env.STRIPE_PRICE_ANNUAL,
  };
  const { plan } = await request.json();
  if (!['monthly', 'annual'].includes(plan)) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return Response.json({ error: 'Price ID not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reuse existing Stripe customer if we have one
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  let customerId = existing?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { plan },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?upgraded=true`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return Response.json({ url: session.url });
}

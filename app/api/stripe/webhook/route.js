import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Must read raw body for Stripe signature verification
export async function POST(request) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('[webhook] event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePayment(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

async function handleCheckoutComplete(session) {
  const userId = session.client_reference_id;
  if (!userId || !session.subscription) return;

  const sub  = await stripe.subscriptions.retrieve(session.subscription);
  const plan = session.metadata?.plan ?? 'monthly';
  const premiumUntil = new Date(sub.current_period_end * 1000).toISOString();

  const { error } = await supabase.from('subscriptions').upsert({
    user_id:                userId,
    stripe_customer_id:     session.customer,
    stripe_subscription_id: session.subscription,
    plan,
    premium_until:          premiumUntil,
    updated_at:             new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) console.error('[webhook] upsert error:', error.message);
}

async function handleInvoicePayment(invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription);
  const premiumUntil = new Date(sub.current_period_end * 1000).toISOString();

  await supabase.from('subscriptions')
    .update({ premium_until: premiumUntil, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', invoice.subscription);
}

async function handleSubscriptionDeleted(sub) {
  // User keeps access until period end; just clear the subscription ID so it won't renew
  await supabase.from('subscriptions')
    .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendPremiumEmail } from '../premium-email';

// Raw body required for Stripe signature verification — disable body parsing
export const config = { api: { bodyParser: false } };

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature error:', err.message,
      '| secret_prefix:', process.env.STRIPE_WEBHOOK_SECRET?.slice(0, 14) ?? 'MISSING');
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object, stripe, supabase);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePayment(event.data.object, stripe, supabase);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

async function handleCheckoutComplete(session, stripe, supabase) {
  const userId = session.client_reference_id;
  if (!userId || !session.subscription) return;

  const sub  = await stripe.subscriptions.retrieve(session.subscription);
  const plan = session.metadata?.plan ?? 'monthly';

  // current_period_end was removed in Stripe SDK v17. Derive from billing_cycle_anchor
  // + plan interval. invoice.payment_succeeded will keep this updated on renewal.
  const anchor = sub.billing_cycle_anchor ?? sub.start_date ?? Math.floor(Date.now() / 1000);
  const intervalDays = plan === 'annual' ? 366 : 32;
  const premiumUntil = new Date((anchor + intervalDays * 24 * 60 * 60) * 1000).toISOString();

  const { error } = await supabase.from('subscriptions').upsert({
    user_id:                userId,
    stripe_customer_id:     session.customer,
    stripe_subscription_id: session.subscription,
    status:                 'active',
    plan,
    premium_until:          premiumUntil,
    updated_at:             new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) { console.error('[webhook] upsert error:', error.message); return; }

  // Send premium confirmation email — look up the user's email from Supabase auth
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (user?.email) {
    await sendPremiumEmail(user.email, plan);
  }
}

async function handleInvoicePayment(invoice, stripe, supabase) {
  if (!invoice.subscription) return;

  // invoice.period_end is on the event object directly — no extra API call needed,
  // and avoids the removed current_period_end field on the subscription in SDK v17.
  const premiumUntil = invoice.period_end
    ? new Date(invoice.period_end * 1000).toISOString()
    : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('subscriptions')
    .update({ status: 'active', premium_until: premiumUntil, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', invoice.subscription);

  if (error) console.error('[webhook] invoice update error:', error.message);
}

async function handleSubscriptionUpdated(sub, supabase) {
  const anchor = sub.billing_cycle_anchor ?? sub.start_date ?? Math.floor(Date.now() / 1000);
  const premiumUntil = new Date((anchor + 32 * 24 * 60 * 60) * 1000).toISOString();
  const status = sub.status === 'active' ? 'active' : sub.status;

  const { error } = await supabase.from('subscriptions')
    .update({ status, premium_until: premiumUntil, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);

  if (error) console.error('[webhook] subscription update error:', error.message);
}

async function handleSubscriptionDeleted(sub, supabase) {
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'cancelled', premium_until: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);

  if (error) console.error('[webhook] subscription delete error:', error.message);
}

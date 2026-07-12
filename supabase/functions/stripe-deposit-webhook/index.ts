// POST /stripe-deposit-webhook
// Handles checkout.session.completed for deposit payments. Verifies the Stripe
// signature, checks idempotency via payment_events, and credits the user's
// balance via the deposit_from_webhook RPC (atomic, service-role only).
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { json, stripeClient, serviceClient, env } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return json({ error: "missing signature" }, 400);

  const body = await req.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, env("STRIPE_DEPOSIT_WEBHOOK_SECRET"));
  } catch (e) {
    return json({ error: `signature failed: ${(e as Error).message}` }, 400);
  }

  if (event.type !== "checkout.session.completed") return json({ received: true });

  const session = (event.data.object as unknown) as Stripe.Checkout.Session;
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "deposit") return json({ received: true });

  const userId = meta.dubbed_user_id;
  const amount = Number(meta.amount || 0);
  if (!userId || amount <= 0) return json({ error: "bad metadata" }, 400);

  const db = serviceClient();

  // Idempotency — skip if we've already processed this session
  const { data: existing } = await db
    .from("payment_events").select("id").eq("external_id", session.id).maybeSingle();
  if (existing) return json({ received: true, duplicate: true });

  // Record the event
  await db.from("payment_events").insert({
    external_id: session.id, user_id: userId, amount, event_type: "deposit",
  });

  // Credit balance atomically via RPC
  const { error } = await db.rpc("deposit_from_webhook", {
    p_user: userId, p_amount: amount, p_ref: session.id,
  });

  if (error) return json({ error: error.message }, 500);
  return json({ received: true, credited: amount });
});

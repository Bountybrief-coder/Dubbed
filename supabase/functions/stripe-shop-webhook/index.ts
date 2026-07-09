// POST /stripe-shop-webhook
// Verified Stripe webhook for Shop events. Handles:
//   checkout.session.completed  -> grant one-time account-service purchases
//   customer.subscription.*     -> sync WAGR membership status
//   invoice.paid                -> record recurring membership payment
//
// Idempotency: subscription events are recorded once in subscription_events;
// one-time purchases check shop_purchases.stripe_ref for duplicate sessions.
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
    event = await stripe.webhooks.constructEventAsync(
      body, sig, env("STRIPE_SHOP_WEBHOOK_SECRET"),
    );
  } catch (e) {
    return json({ error: `signature verification failed: ${(e as Error).message}` }, 400);
  }

  const db = serviceClient();
  const obj = event.data.object as Record<string, unknown>;

  try {
    switch (event.type) {
      // ---- One-time account-service checkout ----
      case "checkout.session.completed": {
        const session = obj as unknown as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          const meta = (session.metadata ?? {}) as Record<string, string>;
          const userId = meta.dubbed_user_id;
          const item = meta.item;
          if (userId && item) {
            await db.rpc("grant_shop_item", {
              p_user: userId,
              p_item: item,
              p_stripe_ref: session.id,
            });
          }
        }
        // Subscription checkouts are handled by customer.subscription.created.
        break;
      }

      // ---- WAGR Membership lifecycle ----
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = obj as unknown as Stripe.Subscription;
        const meta = (sub.metadata ?? {}) as Record<string, string>;
        const userId = meta.dubbed_user_id;
        if (!userId) break;

        // Idempotent event sink.
        const { data: firstTime } = await db.rpc("record_subscription_event", {
          p_event_id: event.id,
          p_event_type: event.type,
          p_user: userId,
          p_payload: event as unknown as Record<string, unknown>,
        });
        if (firstTime === false) return json({ received: true, duplicate: true });

        const status = sub.status; // active | past_due | canceled | unpaid | incomplete | trialing
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        await db.rpc("sync_subscription", {
          p_user: userId,
          p_status: status,
          p_subscription_id: sub.id,
          p_current_period_end: periodEnd,
        });

        // Record a membership purchase on creation so purchase history shows it.
        if (event.type === "customer.subscription.created") {
          await db.rpc("grant_shop_item", {
            p_user: userId,
            p_item: "wagr_membership",
            p_stripe_ref: sub.id,
          });
        }
        break;
      }

      // ---- Recurring invoice paid (membership renewal) ----
      case "invoice.paid": {
        const invoice = obj as unknown as Stripe.Invoice;
        const subId = (invoice.subscription as string) ?? null;
        if (!subId) break;
        // Find the user by subscription id and log the renewal.
        const { data: profile } = await db
          .from("profiles")
          .select("id")
          .eq("subscription_id", subId)
          .maybeSingle();
        if (profile) {
          const { data: first } = await db.rpc("record_subscription_event", {
            p_event_id: event.id,
            p_event_type: event.type,
            p_user: profile.id,
            p_payload: event as unknown as Record<string, unknown>,
          });
          if (first !== false) {
            const amount = ((invoice.amount_paid ?? 0) / 100).toFixed(2);
            await db.from("shop_purchases").insert({
              user_id: profile.id,
              item_key: "wagr_membership",
              item_name: "WAGR Membership (renewal)",
              category: "membership",
              price: Number(amount),
              payment_method: "stripe",
              status: "completed",
              stripe_ref: invoice.id,
            });
            // Grant $1 monthly wallet credit on each renewal
            await db.rpc("grant_wagr_monthly_credit", { p_user: profile.id });
          }
        }
        break;
      }

      default:
        break;
    }

    return json({ received: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// POST /stripe-webhook
// Verified Stripe webhook endpoint. Handles Connect + payout lifecycle:
//   account.updated        -> sync onboarding/charges/payouts/verification
//   transfer.created       -> (informational; request already has transfer_id)
//   payout.paid            -> mark the matching withdrawal 'paid'
//   payout.failed          -> reject + refund the matching withdrawal
//   transfer.reversed      -> reject + refund (funds pulled back)
//
// Idempotency is enforced two ways: Stripe event ids are recorded once in
// payout_events, and the underlying RPCs (mark_withdrawal_paid / reject) are
// themselves idempotent on terminal states.
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
    event = await stripe.webhooks.constructEventAsync(body, sig, env("STRIPE_WEBHOOK_SECRET"));
  } catch (e) {
    return json({ error: `signature verification failed: ${(e as Error).message}` }, 400);
  }

  const db = serviceClient();

  // Resolve the related withdrawal (where applicable) so we can tag the event.
  let withdrawalId: string | null = null;
  const obj = event.data.object as Record<string, unknown>;

  try {
    if (event.type === "transfer.created" || event.type === "transfer.reversed") {
      const meta = (obj.metadata as Record<string, string>) ?? {};
      withdrawalId = meta.withdrawal_id ?? null;
      if (!withdrawalId) {
        const { data } = await db.rpc("withdrawal_by_ref", { p_transfer: obj.id as string, p_payout: null });
        withdrawalId = (data as string) ?? null;
      }
    } else if (event.type === "payout.failed") {
      const meta = (obj.metadata as Record<string, string>) ?? {};
      withdrawalId = meta.withdrawal_id ?? null;
    }

    // Record the event once. If we've seen it, ack and stop.
    const { data: firstTime } = await db.rpc("record_payout_event", {
      p_provider: "stripe",
      p_event_id: event.id,
      p_event_type: event.type,
      p_withdrawal: withdrawalId,
      p_payload: event as unknown as Record<string, unknown>,
    });
    if (firstTime === false) return json({ received: true, duplicate: true });

    switch (event.type) {
      case "account.updated": {
        const acct = obj as unknown as Stripe.Account;
        const userId = (acct.metadata as Record<string, string>)?.dubbed_user_id;
        if (userId) {
          const payouts = Boolean(acct.payouts_enabled);
          await db.rpc("sync_stripe_account", {
            p_user: userId,
            p_account_id: acct.id,
            p_onboarding: Boolean(acct.details_submitted),
            p_charges: Boolean(acct.charges_enabled),
            p_payouts: payouts,
            p_verification: payouts ? "verified" : acct.details_submitted ? "pending" : "onboarding",
          });
        }
        break;
      }
      case "payout.failed": {
        if (withdrawalId) {
          await db.rpc("reject_withdrawal", {
            p_id: withdrawalId,
            p_reason: `Payout failed: ${(obj.failure_message as string) ?? "unknown"}`,
          });
        }
        break;
      }
      case "transfer.created": {
        // Destination-transfer model: a successful transfer to the connected
        // account is the user receiving their funds. Mark the withdrawal paid;
        // Stripe then auto-pays it out to their bank on their payout schedule.
        if (withdrawalId) {
          await db.rpc("mark_withdrawal_paid", {
            p_id: withdrawalId,
            p_payout_id: obj.id as string,
            p_transfer_id: obj.id as string,
          });
        }
        break;
      }
      case "transfer.reversed": {
        if (withdrawalId) {
          await db.rpc("reject_withdrawal", {
            p_id: withdrawalId,
            p_reason: "Transfer reversed by Stripe",
          });
        }
        break;
      }
      case "payout.paid":
      default:
        // Informational for the destination-transfer model.
        break;
    }

    return json({ received: true });
  } catch (e) {
    // Return 500 so Stripe retries; our idempotency makes retries safe.
    return json({ error: (e as Error).message }, 500);
  }
});

// POST /stripe-payout   { withdrawal_id }
// Admin-only. Marks the held withdrawal 'processing', then creates a Stripe
// Transfer to the user's connected Express account. The webhook later marks it
// 'paid' (payout.paid) or fails it (payout.failed / transfer reversal).
//
// Idempotency: the withdrawal id is the Stripe idempotency key, so a retried
// approve can never double-pay.
import { CORS, json, stripeClient, serviceClient, getCaller, env } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const db = serviceClient();

    // Admin check — direct table read under service role (never trust client).
    const { data: adminRow } = await db
      .from("app_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (!adminRow) return json({ error: "admin only" }, 403);

    const { withdrawal_id } = await req.json().catch(() => ({}));
    if (!withdrawal_id) return json({ error: "withdrawal_id required" }, 400);

    const { data: w, error: wErr } = await db
      .from("withdrawal_requests")
      .select("id, user_id, amount, status")
      .eq("id", withdrawal_id)
      .maybeSingle();
    if (wErr) return json({ error: wErr.message }, 500);
    if (!w) return json({ error: "withdrawal not found" }, 404);
    if (w.status === "paid") return json({ ok: true, already: "paid" });
    if (w.status === "rejected") return json({ error: "withdrawal was rejected" }, 400);

    const { data: profile } = await db
      .from("profiles")
      .select("stripe_account_id, stripe_payouts_enabled, suspended")
      .eq("id", w.user_id)
      .maybeSingle();
    if (!profile?.stripe_account_id) return json({ error: "user has no connected account" }, 400);
    if (!profile.stripe_payouts_enabled) return json({ error: "user payouts not enabled" }, 400);
    if (profile.suspended) return json({ error: "user is suspended" }, 400);

    // pending -> processing (service RPC; safe to call once).
    if (w.status === "pending") {
      const { error: procErr } = await db.rpc("mark_withdrawal_processing_admin", {
        p_id: w.id,
        p_admin: caller.id,
      });
      if (procErr) return json({ error: procErr.message }, 500);
    }

    const stripe = stripeClient();
    const amountCents = Math.round(Number(w.amount) * 100);

    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: (env("PAYOUT_CURRENCY") || "usd").toLowerCase(),
        destination: profile.stripe_account_id,
        metadata: { withdrawal_id: w.id, dubbed_user_id: w.user_id },
      },
      { idempotencyKey: `dubbed_wd_${w.id}` },
    );

    await db.from("withdrawal_requests").update({ transfer_id: transfer.id }).eq("id", w.id);

    return json({ ok: true, transfer_id: transfer.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

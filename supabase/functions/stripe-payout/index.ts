// POST /stripe-payout   { withdrawal_id }
// Fires a Stripe Transfer for a withdrawal. Allowed callers:
//   - Admin: can fire any pending/processing withdrawal
//   - Owner: can fire their own auto-approved withdrawal (already in processing)
//
// Idempotency: the withdrawal id is the Stripe idempotency key, so a retried
// call can never double-pay.
import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const db = serviceClient();

    const { data: adminRow } = await db
      .from("app_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const isAdmin = !!adminRow;

    const { withdrawal_id } = await req.json().catch(() => ({}));
    if (!withdrawal_id) return json({ error: "withdrawal_id required" }, 400);

    const { data: w, error: wErr } = await db
      .from("withdrawal_requests")
      .select("id, user_id, amount, fee, status, meta")
      .eq("id", withdrawal_id)
      .maybeSingle();
    if (wErr) return json({ error: wErr.message }, 500);
    if (!w) return json({ error: "withdrawal not found" }, 404);

    // Authorization: admin can fire anything; owner can only fire auto-approved
    if (!isAdmin) {
      if (w.user_id !== caller.id) return json({ error: "not authorized" }, 403);
      if (w.status !== "processing") return json({ error: "withdrawal not in processing state" }, 403);
      if (!w.meta?.auto_approved) return json({ error: "withdrawal not auto-approved" }, 403);
    }

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

    // Admin path: mark processing if still pending
    if (isAdmin && w.status === "pending") {
      const { error: procErr } = await db.rpc("mark_withdrawal_processing_admin", {
        p_id: w.id,
        p_admin: caller.id,
      });
      if (procErr) return json({ error: procErr.message }, 500);
    }

    const stripe = stripeClient();
    const amountCents = Math.round((Number(w.amount) - Number(w.fee || 0)) * 100);

    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: (Deno.env.get("PAYOUT_CURRENCY") || "usd").toLowerCase(),
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

// POST /nowpayments-payout   { withdrawal_id }
// Sends a crypto payout for a withdrawal request. Reads the user's saved
// crypto wallet address from their profile. Allowed callers:
//   - Admin: can fire any pending/processing withdrawal
//   - Owner: can fire their own auto-approved withdrawal (already in processing)
//
// Idempotency: the withdrawal id in the order_id prevents double-pays.
import { CORS, json, npFetch, serviceClient, getCaller } from "../_shared/util.ts";

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

    if (!isAdmin) {
      if (w.user_id !== caller.id) return json({ error: "not authorized" }, 403);
      if (w.status !== "processing") return json({ error: "withdrawal not in processing state" }, 403);
      if (!w.meta?.auto_approved) return json({ error: "withdrawal not auto-approved" }, 403);
    }

    if (w.status === "paid") return json({ ok: true, already: "paid" });
    if (w.status === "rejected") return json({ error: "withdrawal was rejected" }, 400);

    const { data: profile } = await db
      .from("profiles")
      .select("crypto_wallet_address, crypto_wallet_currency, suspended")
      .eq("id", w.user_id)
      .maybeSingle();
    if (!profile?.crypto_wallet_address) return json({ error: "user has no crypto wallet address" }, 400);
    if (profile.suspended) return json({ error: "user is suspended" }, 400);

    if (isAdmin && w.status === "pending") {
      const { error: procErr } = await db.rpc("mark_withdrawal_processing_admin", {
        p_id: w.id, p_admin: caller.id,
      });
      if (procErr) return json({ error: procErr.message }, 500);
    }

    const netAmount = Number(w.amount) - Number(w.fee || 0);
    if (!Number.isFinite(netAmount) || netAmount < 1) return json({ error: "payout amount too small after fees" }, 400);

    const currency = (profile.crypto_wallet_currency || "usdttrc20").toLowerCase();

    const payout = await npFetch("/payout", {
      method: "POST",
      body: {
        address: profile.crypto_wallet_address,
        currency,
        amount: netAmount,
        ipn_callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-webhook`,
        order_id: `payout_${w.id}`,
      },
    }) as Record<string, unknown>;

    const payoutId = String(payout.id ?? "");
    await db.from("withdrawal_requests").update({ transfer_id: payoutId }).eq("id", w.id);

    return json({ ok: true, payout_id: payoutId });
  } catch (e) {
    console.error("payout error:", (e as Error).message);
    return json({ error: "Payout failed. Please try again or contact support." }, 500);
  }
});

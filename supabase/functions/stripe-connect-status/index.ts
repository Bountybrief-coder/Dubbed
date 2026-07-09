// POST /stripe-connect-status
// Pulls the caller's Express account from Stripe and syncs onboarding/charges/
// payouts/verification status into their profile via the sync RPC.
import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const db = serviceClient();
    const { data: profile } = await db
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", caller.id)
      .maybeSingle();

    const accountId = profile?.stripe_account_id as string | null;
    if (!accountId) return json({ error: "no connected account" }, 400);

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(accountId);

    const onboarding = Boolean(account.details_submitted);
    const charges = Boolean(account.charges_enabled);
    const payouts = Boolean(account.payouts_enabled);
    const verification = payouts ? "verified" : onboarding ? "pending" : "onboarding";

    const { error: rpcErr } = await db.rpc("sync_stripe_account", {
      p_user: caller.id,
      p_account_id: accountId,
      p_onboarding: onboarding,
      p_charges: charges,
      p_payouts: payouts,
      p_verification: verification,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    return json({ onboarding, charges, payouts, verification });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// POST /stripe-connect-onboard
// Creates (or reuses) the caller's Stripe Express account and returns a
// one-time onboarding Account Link. Secret key stays server-side.
import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const base = "https://dubbed.pro/wallet";
    const return_url = `${base}?stripe=return`;
    const refresh_url = `${base}?stripe=refresh`;

    const stripe = stripeClient();
    const db = serviceClient();

    const { data: profile, error: pErr } = await db
      .from("profiles")
      .select("id, username, stripe_account_id")
      .eq("id", caller.id)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!profile) return json({ error: "profile not found" }, 404);

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { dubbed_user_id: caller.id, username: profile.username ?? "" },
      });
      accountId = account.id;
      const { error: uErr } = await db
        .from("profiles")
        .update({ stripe_account_id: accountId, stripe_verification_status: "onboarding" })
        .eq("id", caller.id);
      if (uErr) return json({ error: uErr.message }, 500);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      return_url,
      refresh_url,
      type: "account_onboarding",
    });

    return json({ url: link.url });
  } catch (e) {
    console.error("connect-onboard error:", (e as Error).message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

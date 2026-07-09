// POST /stripe-billing-portal   { return_url }
// Opens a Stripe Customer Portal session so WAGR members can manage or cancel
// their subscription. Requires an existing Stripe customer id.
import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const { return_url } = await req.json().catch(() => ({}));
    if (!return_url) return json({ error: "return_url required" }, 400);

    const db = serviceClient();
    const { data: row } = await db
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!row?.customer_id) return json({ error: "no billing account found" }, 400);

    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: row.customer_id as string,
      return_url,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

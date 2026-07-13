// POST /stripe-shop-checkout   { item, success_url, cancel_url }
// Creates a Stripe Checkout Session. Account services are one-time payments;
// WAGR membership is a recurring subscription. Prices come from the DB
// (shop_price) so the client can never set them. A Stripe customer is created
// and stored per user so subscriptions + the billing portal work.
import { CORS, json, stripeClient, serviceClient, getCaller, env } from "../_shared/util.ts";

const CURRENCY = (Deno.env.get("PAYOUT_CURRENCY") || "usd").toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const { item } = await req.json().catch(() => ({}));
    if (!item) return json({ error: "item required" }, 400);
    const base = "https://dubbed.pro/shop";
    const success_url = `${base}?purchase=success&item=${encodeURIComponent(item)}`;
    const cancel_url = `${base}?purchase=cancel`;

    const db = serviceClient();
    const stripe = stripeClient();

    // Server-side price (never trust client).
    const { data: price } = await db.rpc("shop_price", { p_item: item });
    if (price == null) return json({ error: "unknown item" }, 400);
    const { data: itemName } = await db.rpc("shop_item_name", { p_item: item });

    const { data: profile } = await db
      .from("profiles")
      .select("id, username, subscription_id")
      .eq("id", caller.id)
      .maybeSingle();
    if (!profile) return json({ error: "profile not found" }, 404);

    // Reuse or create a Stripe customer (stored in the private mapping table).
    const { data: existing } = await db
      .from("stripe_customers").select("customer_id").eq("user_id", caller.id).maybeSingle();
    let customerId = existing?.customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { dubbed_user_id: caller.id, username: profile.username ?? "" },
      });
      customerId = customer.id;
      await db.from("stripe_customers").insert({ user_id: caller.id, customer_id: customerId });
    }

    const isMembership = item === "wagr_membership";
    const amountCents = Math.round(Number(price) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: isMembership ? "subscription" : "payment",
      customer: customerId,
      success_url,
      cancel_url,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            product_data: { name: itemName ?? item },
            unit_amount: amountCents,
            ...(isMembership ? { recurring: { interval: "month" } } : {}),
          },
        },
      ],
      metadata: { dubbed_user_id: caller.id, item },
      ...(isMembership ? { subscription_data: { metadata: { dubbed_user_id: caller.id, item } } } : {}),
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("shop-checkout error:", (e as Error).message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

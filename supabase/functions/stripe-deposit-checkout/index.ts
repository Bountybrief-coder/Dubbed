import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const { amount, return_url } = await req.json().catch(() => ({}));
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 500) return json({ error: "Minimum deposit is $5" }, 400);
    if (cents > 100000) return json({ error: "Maximum deposit is $1,000" }, 400);

    const base = "https://dubbed.pro/wallet";
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Dubbed Wallet Deposit" },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      metadata: { dubbed_user_id: caller.id, type: "deposit", amount: String(cents / 100) },
      success_url: `${base}?deposit=success`,
      cancel_url: `${base}?deposit=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("deposit-checkout error:", (e as Error).message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

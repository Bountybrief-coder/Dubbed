import { CORS, json, stripeClient, serviceClient, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const { amount, return_url } = await req.json().catch(() => ({}));
    if (!amount || Number(amount) < 5) return json({ error: "Minimum deposit is $5" }, 400);

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Dubbed Wallet Deposit" },
          unit_amount: Math.round(Number(amount) * 100),
        },
        quantity: 1,
      }],
      metadata: { dubbed_user_id: caller.id, type: "deposit", amount: String(amount) },
      success_url: `${return_url || "https://dubbed.pro/wallet"}?deposit=success`,
      cancel_url: `${return_url || "https://dubbed.pro/wallet"}?deposit=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// POST /nowpayments-deposit   { amount }
// Creates a NOWPayments invoice for a wallet deposit. The user is redirected
// to NOWPayments' hosted checkout. On payment confirmation, the IPN webhook
// credits the balance via deposit_from_webhook RPC.
import { CORS, json, npFetch, getCaller } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);

    const { amount } = await req.json().catch(() => ({}));
    const usd = Number(amount);
    if (!Number.isFinite(usd) || usd < 5) return json({ error: "Minimum deposit is $5" }, 400);
    if (usd > 1000) return json({ error: "Maximum deposit is $1,000" }, 400);

    const invoice = await npFetch("/invoice", {
      method: "POST",
      body: {
        price_amount: usd,
        price_currency: "usd",
        order_id: `deposit_${caller.id}_${Date.now()}`,
        order_description: `Dubbed Wallet Deposit $${usd}`,
        ipn_callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-webhook`,
        success_url: "https://dubbed.pro/wallet?deposit=success",
        cancel_url: "https://dubbed.pro/wallet?deposit=cancel",
        is_fixed_rate: true,
        is_fee_paid_by_user: false,
      },
    }) as Record<string, unknown>;

    return json({ url: invoice.invoice_url, id: invoice.id });
  } catch (e) {
    console.error("deposit error:", (e as Error).message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
